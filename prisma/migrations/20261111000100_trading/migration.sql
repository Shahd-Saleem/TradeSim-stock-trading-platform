-- Preserve all accounts and balances. Only the server runtime receives write rights.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tradesim_runtime') THEN
    GRANT UPDATE ("cashBalanceFils", "updatedAt") ON tradesim."VirtualAccount" TO tradesim_runtime;
    GRANT INSERT, UPDATE, DELETE ON tradesim."Holding" TO tradesim_runtime;
    GRANT INSERT ON tradesim."Trade" TO tradesim_runtime;
  END IF;
END $$;

CREATE FUNCTION tradesim.reject_trade_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = tradesim, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Trade history is immutable' USING ERRCODE = '23514';
END;
$$;
REVOKE ALL ON FUNCTION tradesim.reject_trade_mutation() FROM PUBLIC;
CREATE TRIGGER trade_immutable BEFORE UPDATE OR DELETE ON tradesim."Trade"
FOR EACH ROW EXECUTE FUNCTION tradesim.reject_trade_mutation();
