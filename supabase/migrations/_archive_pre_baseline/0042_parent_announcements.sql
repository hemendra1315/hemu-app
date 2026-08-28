-- Add all_parents to announcement_audience
ALTER TYPE audience_type ADD VALUE IF NOT EXISTS 'all_parents';
