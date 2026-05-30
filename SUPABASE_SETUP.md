# عيلتنا — Supabase Setup Guide

## Step 1 — Create Supabase project
1. Go to supabase.com → Sign up free
2. Click "New project"
3. Give it any name (e.g. "aylitna")
4. Choose a region close to you (e.g. EU West)
5. Wait ~2 minutes for it to set up

## Step 2 — Create the database tables
In your Supabase project, go to SQL Editor and paste this entire block:

```sql
-- Posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  caption TEXT DEFAULT '',
  photo_url TEXT,
  oct TEXT DEFAULT 'everyday',
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public" ON posts FOR ALL USING (true) WITH CHECK (true);

-- Messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public" ON messages FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

Click "Run" — you should see "Success".

## Step 3 — Create photo storage
1. In your Supabase project, go to Storage
2. Click "New bucket"
3. Name it exactly: photos
4. Check "Public bucket" ✅
5. Click Create

Then go to Storage → Policies → New policy → For "photos" bucket:
- Policy name: Public
- Allowed operation: SELECT, INSERT
- Target roles: (leave empty = everyone)
- Policy definition: true
- Click Save

## Step 4 — Get your API keys
In your Supabase project:
1. Go to Settings → API
2. Copy "Project URL" 
3. Copy "anon / public" key (NOT the secret key)

## Step 5 — Add keys to the app
Open index.html in a text editor.
Find these two lines near the top of the script:

```
const SUPABASE_URL = '';
const SUPABASE_KEY = '';
```

Fill them in:
```
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Step 6 — Redeploy
Go to your Netlify project → drag the updated aylitna-v3 folder again.
Done. The app is now live and fully shared across all family devices.

## What works without Supabase
The app works perfectly in "local mode" without Supabase — each person's phone
saves their own data. Good for showing dad on his birthday before you set up Supabase.

## Free tier limits
- Database: 500MB (enough for thousands of posts)
- Storage: 1GB for photos
- Bandwidth: 2GB/month
- Realtime connections: 200 concurrent
All more than enough for a family.
