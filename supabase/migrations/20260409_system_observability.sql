-- System Observability Tables

-- System logs for tracking errors, AI failures, OCR failures
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  service VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs(service);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- API request tracking
CREATE TABLE IF NOT EXISTS api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'POST',
  status VARCHAR(20) NOT NULL,
  response_time_ms INTEGER,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint ON api_requests(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON api_requests(created_at DESC);

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all system logs" ON system_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_teacher'))
  );

CREATE POLICY "System can insert system logs" ON system_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view api requests" ON api_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'head_teacher'))
  );

CREATE POLICY "System can insert api requests" ON api_requests
  FOR INSERT WITH CHECK (true);