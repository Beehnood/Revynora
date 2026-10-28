-- Protect published catalogue projections, including against legacy initialization scripts.
CREATE FUNCTION g9_catalog_projection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version "CommercialOfferVersion"%ROWTYPE;
BEGIN
 IF NEW.code IS DISTINCT FROM OLD.code THEN RAISE EXCEPTION 'Commercial offer identity is permanent'; END IF;
 IF OLD."currentVersionId" IS NOT NULL AND NEW."currentVersionId" IS NULL THEN RAISE EXCEPTION 'Published catalogue cannot be cleared'; END IF;
 IF NEW."currentVersionId" IS NOT NULL THEN
  SELECT * INTO version FROM "CommercialOfferVersion" WHERE id=NEW."currentVersionId";
  IF NOT FOUND OR version."subscriptionId"<>NEW.id OR version.state<>'PUBLISHED' OR
   (NEW.name,NEW."priceCents",NEW.currency,NEW.interval,NEW.active) IS DISTINCT FROM
   (version.name,version."priceCents",version.currency,version.interval,version.active) THEN
   RAISE EXCEPTION 'Catalogue must match its immutable published version';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER g9_catalog_projection BEFORE UPDATE ON "Subscription" FOR EACH ROW EXECUTE FUNCTION g9_catalog_projection();
