-- ============================================
-- PLANNING COUPLE - SCHEMA SUPABASE
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- 1. PROFILES (étend auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  partner_id UUID REFERENCES profiles(id),
  default_event_color TEXT DEFAULT '#6366f1',
  default_note_color TEXT DEFAULT '#fef3c7',
  week_starts_on INT DEFAULT 1, -- 0=dimanche, 1=lundi
  default_view TEXT DEFAULT 'month', -- month, week, day, agenda
  timezone TEXT DEFAULT 'Asia/Qatar',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EVENTS
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  color TEXT DEFAULT '#6366f1',
  shared BOOLEAN DEFAULT FALSE,
  reminder_minutes INT, -- NULL = pas de rappel, sinon nb minutes avant
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_events_shared ON events(shared) WHERE shared = TRUE;

-- 3. NOTES
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'text', -- text, todo
  color TEXT DEFAULT '#fef3c7',
  shared BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_shared ON notes(shared) WHERE shared = TRUE;

-- 4. NOTE ITEMS (pour les listes to-do)
CREATE TABLE IF NOT EXISTS note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  checked BOOLEAN DEFAULT FALSE,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_items_note ON note_items(note_id);

-- 5. NOTIFICATIONS (file d'attente pour les push)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- event_added, event_updated, note_added, note_updated, reminder
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id, read, created_at DESC);

-- 6. PUSH SUBSCRIPTIONS (pour Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile and partner"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id 
    OR auth.uid() = partner_id
    OR id IN (SELECT partner_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- EVENTS policies
CREATE POLICY "Users see own events and partner shared events"
  ON events FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      shared = TRUE 
      AND user_id IN (
        SELECT partner_id FROM profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM profiles WHERE partner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users manage own events"
  ON events FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTES policies
CREATE POLICY "Users see own notes and partner shared notes"
  ON notes FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      shared = TRUE 
      AND user_id IN (
        SELECT partner_id FROM profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM profiles WHERE partner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users manage own notes"
  ON notes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTE ITEMS policies
CREATE POLICY "Users see items of accessible notes"
  ON note_items FOR SELECT
  USING (
    note_id IN (
      SELECT id FROM notes 
      WHERE user_id = auth.uid()
      OR (shared = TRUE AND user_id IN (
        SELECT partner_id FROM profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM profiles WHERE partner_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users manage items of own notes"
  ON note_items FOR ALL
  USING (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
  );

-- Permettre au partenaire de cocher/décocher les items des notes partagées
CREATE POLICY "Partner can update checked status of shared note items"
  ON note_items FOR UPDATE
  USING (
    note_id IN (
      SELECT id FROM notes 
      WHERE shared = TRUE AND user_id IN (
        SELECT partner_id FROM profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM profiles WHERE partner_id = auth.uid()
      )
    )
  );

-- NOTIFICATIONS policies
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "Anyone authenticated can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- PUSH SUBSCRIPTIONS policies
CREATE POLICY "Users manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-création du profil à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Notification automatique au partenaire quand événement partagé créé
CREATE OR REPLACE FUNCTION notify_partner_on_shared_event()
RETURNS TRIGGER AS $$
DECLARE
  partner_uuid UUID;
  sender_name TEXT;
BEGIN
  IF NEW.shared = TRUE THEN
    SELECT partner_id, display_name INTO partner_uuid, sender_name
    FROM profiles WHERE id = NEW.user_id;
    
    IF partner_uuid IS NULL THEN
      SELECT id INTO partner_uuid FROM profiles WHERE partner_id = NEW.user_id LIMIT 1;
    END IF;
    
    IF partner_uuid IS NOT NULL THEN
      INSERT INTO notifications (recipient_id, sender_id, type, title, body, data)
      VALUES (
        partner_uuid,
        NEW.user_id,
        CASE WHEN TG_OP = 'INSERT' THEN 'event_added' ELSE 'event_updated' END,
        CASE WHEN TG_OP = 'INSERT' 
          THEN COALESCE(sender_name, 'Partenaire') || ' a ajouté un événement'
          ELSE COALESCE(sender_name, 'Partenaire') || ' a modifié un événement'
        END,
        NEW.title,
        jsonb_build_object('event_id', NEW.id, 'start_at', NEW.start_at)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS event_share_notify ON events;
CREATE TRIGGER event_share_notify
  AFTER INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION notify_partner_on_shared_event();

-- Notification automatique au partenaire quand note partagée créée
CREATE OR REPLACE FUNCTION notify_partner_on_shared_note()
RETURNS TRIGGER AS $$
DECLARE
  partner_uuid UUID;
  sender_name TEXT;
BEGIN
  IF NEW.shared = TRUE AND (TG_OP = 'INSERT' OR OLD.shared = FALSE OR OLD.title != NEW.title OR OLD.content != NEW.content) THEN
    SELECT partner_id, display_name INTO partner_uuid, sender_name
    FROM profiles WHERE id = NEW.user_id;
    
    IF partner_uuid IS NULL THEN
      SELECT id INTO partner_uuid FROM profiles WHERE partner_id = NEW.user_id LIMIT 1;
    END IF;
    
    IF partner_uuid IS NOT NULL THEN
      INSERT INTO notifications (recipient_id, sender_id, type, title, body, data)
      VALUES (
        partner_uuid,
        NEW.user_id,
        CASE WHEN TG_OP = 'INSERT' THEN 'note_added' ELSE 'note_updated' END,
        CASE WHEN TG_OP = 'INSERT' 
          THEN COALESCE(sender_name, 'Partenaire') || ' a partagé une note'
          ELSE COALESCE(sender_name, 'Partenaire') || ' a modifié une note'
        END,
        NEW.title,
        jsonb_build_object('note_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS note_share_notify ON notes;
CREATE TRIGGER note_share_notify
  AFTER INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION notify_partner_on_shared_note();

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE note_items;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
