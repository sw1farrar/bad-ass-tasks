# Removed features — historical SQL only

These scripts created Map (stores, territories, PostGIS helpers), Health readings, and the notebook Investments, Customers, and Competitors tables.

They are **superseded**. The application no longer reads or writes these objects. Each file raises an exception if applied, so a routine `apply-supabase-sql` run cannot recreate the tables.

Do not delete the live tables from this archive. Dropping them is a later, separately approved step. The statements below each guard are kept so that rollback can be reconstructed by removing the guard first.

`supabase/add-notebook-sections.sql` stays in `supabase/` because it still creates notebook tasks. The investments, customers, competitors, and `our_sales` portions were removed from that script.
