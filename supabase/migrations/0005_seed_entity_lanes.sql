-- ============================================================
-- SeshSure Hub — Migration 0005
-- Seed: issuing entity + freight lane cost basis (Rob, Jul 2026)
-- ============================================================

insert into entities (legal_name, dba, remit_address, is_default) values (
  'Vido Manufacturing and Distribution Corp',
  'SeshSure',
  '10940 S. Parker Rd, Suite 788, Parker, CO 80134',
  true
);

-- Freight cost basis per cone (microcents: 1¢ = 10,000)
-- DAP sea $0.035/cone → EXW ~3¢ + ~0.5¢ sea freight leg
-- DAP air $0.045/cone → EXW ~3¢ + ~1.5¢ air freight leg
insert into freight_lane_rates (mode, per_cone_adder_microcents, notes) values
  ('sea', 5000,  'DAP sea = $0.035/cone all-in cost basis (Rob, 2026-07)'),
  ('air', 15000, 'DAP air = $0.045/cone all-in cost basis (Rob, 2026-07)');
