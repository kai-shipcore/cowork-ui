-- Vehicle fitment schema. Requires PostgreSQL 18+ (uuidv7()) and the
-- citext extension.
-- Standard abbreviations for constraint/index names that would exceed 63
-- bytes: shorten a compound name part to its distinguishing tail
-- (`vehicle_option_value_id` → `option_value_id`, `vehicle_research_id` →
-- `research_id`). Column names are never abbreviated.
-- §2.2 junction participants shortened in table names: shape =
-- vehicle_product_shape, option_value = vehicle_option_value, project =
-- vehicle_project; FK columns keep the full referenced-table name.

CREATE EXTENSION IF NOT EXISTS citext;

-- A product category (Seat Cover, Floor Mat, ...).
CREATE TABLE product_type (
    id         UUID PRIMARY KEY DEFAULT uuidv7(),
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An internal staff department.
CREATE TABLE department (
    id         UUID PRIMARY KEY DEFAULT uuidv7(),
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A factory (Tianhong, ...) that produces samples and production runs.
CREATE TABLE factory (
    id         UUID PRIMARY KEY DEFAULT uuidv7(),
    name       TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT factory_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A vehicle source partner (dealership, rental, private owner, ...):
-- where scan and fitting visits happen. The old Vehicle Partners sheet.
-- What vehicles a partner has in stock is NOT stored — inventory is
-- queried live from an external listings API at hunt time; a partner
-- found there is registered (or matched) here when a field visit is booked.
CREATE TABLE dealership (
    id         UUID PRIMARY KEY DEFAULT uuidv7(),
    name       TEXT NOT NULL UNIQUE,
    address    TEXT,
    note       TEXT,   -- contact person, visiting rules, ...
    status     TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT dealership_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- An internal staff account — the actor behind activity and assets.
-- Includes one seeded SYSTEM account (the actor for jobs and imports);
-- deactivated via status, never deleted.
CREATE TABLE app_user (
    id               UUID PRIMARY KEY DEFAULT uuidv7(),
    department_id    UUID REFERENCES department(id),   -- NULL = no department
    email            CITEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT app_user_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    designer_initial TEXT UNIQUE,   -- NULL = not a designer; rendered into pattern names
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_user_department_id_idx
    ON app_user (department_id);

-- A vehicle make (manufacturer).
CREATE TABLE vehicle_make (
    id           UUID PRIMARY KEY DEFAULT uuidv7(),
    name         TEXT NOT NULL UNIQUE,
    abbreviation TEXT UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A vehicle class (Car, SUV & Van, Truck).
CREATE TABLE vehicle_class (
    id         UUID PRIMARY KEY DEFAULT uuidv7(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A vehicle model, classified by its vehicle class.
CREATE TABLE vehicle_model (
    id               UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_make_id  UUID NOT NULL REFERENCES vehicle_make(id),
    vehicle_class_id UUID NOT NULL REFERENCES vehicle_class(id),
    name             TEXT NOT NULL,
    abbreviation     TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vehicle_make_id, name),
    UNIQUE (vehicle_make_id, abbreviation)
);
CREATE INDEX vehicle_model_vehicle_class_id_idx
    ON vehicle_model (vehicle_class_id);

-- Vehicle option key dictionary (the charts' "OptionN Title"), scoped
-- per product type. Untitled charts (car cover) use one generic
-- 'Submodel' key.
CREATE TABLE vehicle_option_key (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id UUID NOT NULL REFERENCES product_type(id),
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_type_id, name)
);

-- Master list of possible values per vehicle option key.
CREATE TABLE vehicle_option_value (
    id                    UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_option_key_id UUID NOT NULL REFERENCES vehicle_option_key(id),
    value                 TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vehicle_option_key_id, value)
);

-- A developed product shape — one physical pattern, identified by the
-- charts' size codes (FJJ, CN-D, C1-AR-CL01, ...), scoped per product
-- type. Where a shape sits on a vehicle is a per-vehicle fact
-- (unique_vehicle_x_shape_assignment). Identity only lives here;
-- physical dimensions live in the generic 1:1 satellite
-- (vehicle_product_shape_dimension) — present only for families whose shapes
-- carry a size (CC: required once ACTIVE; SC and FM have none — an SC
-- shape is the label of its BOM, an FM shape is its mold — so a bare
-- supertype row is their complete form). A joining family whose size
-- facts fit the shared vocabulary reuses the satellite; one whose
-- facts don't adds its own 1:1 child in its joining migration (#024's
-- pattern — presence rules app-enforced).
-- Lifecycle: the row is created WITH the pattern work (the name is
-- needed the moment drawing starts — DXF file names carry it), status
-- IN_DEVELOPMENT, and the project's vehicle_product_shape_id is set at
-- creation; the FITTING task's DONE (#047: purpose achieved — the
-- whole product fits) confirms it — status ACTIVE. Assignments
-- may reference ACTIVE shapes only (app-enforced). Universal sizes
-- are seeded ACTIVE. A row abandoned by adoption (the project's
-- vehicle_product_shape_id moved to adopted_project_id) stays IN_DEVELOPMENT,
-- unlinked, as the shelf marker of its INACTIVE designs — never
-- deleted (a serial, once printed, is spent); revival relinks and
-- refits it. So: unlinked ACTIVE = universal, unlinked IN_DEVELOPMENT
-- = shelved.
CREATE TABLE vehicle_product_shape (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id UUID NOT NULL REFERENCES product_type(id),
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'IN_DEVELOPMENT'
        CONSTRAINT vehicle_product_shape_status_check
        CHECK (status IN ('IN_DEVELOPMENT', 'ACTIVE', 'RETIRED')),
                    -- created with the pattern work; ACTIVE on fitting
                    -- PASS (see lifecycle above)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_type_id, name)
);

-- Finished-product dimensions of a shape — a generic 1:1 satellite,
-- one physical vocabulary shared by every family that HAS shape-level
-- dimensions; a family without them (SC: a shape is the label of its
-- BOM; FM: the mold) simply has no row. Measured on the confirmed
-- sample — created when the shape turns ACTIVE (an IN_DEVELOPMENT
-- shape has no finished product to measure); "an ACTIVE CC shape has
-- this row" is app-enforced, other families add rows as their sizes
-- call for. The width pair is for cuts that taper front-to-back (car
-- covers: CN-D 143/143, SN-B 169/160 — a symmetric cut stores the
-- same value in both); products without the front/back distinction
-- leave the pair NULL. CC basics are seeded with rows (the size chart
-- carries the dimensions).
CREATE TABLE vehicle_product_shape_dimension (
    id               UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_product_shape_id UUID NOT NULL UNIQUE
        REFERENCES vehicle_product_shape(id) ON DELETE CASCADE,
    length           NUMERIC(12,4) NOT NULL CHECK (length > 0),
    front_width      NUMERIC(12,4) CHECK (front_width > 0),
    back_width       NUMERIC(12,4) CHECK (back_width > 0),
    height           NUMERIC(12,4) NOT NULL CHECK (height > 0),
    dimension_unit   TEXT NOT NULL
        CONSTRAINT vehicle_product_shape_dimension_unit_check
        CHECK (dimension_unit IN ('IN', 'CM')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_product_shape_dimension_width_pair_check
        CHECK ((front_width IS NULL) = (back_width IS NULL))
);

-- A product material (car cover: 03, 15), scoped per product type.
CREATE TABLE product_material (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id UUID NOT NULL REFERENCES product_type(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_type_id, code),
    UNIQUE (product_type_id, name)
);

-- A product color, scoped per product type.
CREATE TABLE product_color (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id UUID NOT NULL REFERENCES product_type(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_type_id, code),
    UNIQUE (product_type_id, name)
);

-- The sellable, stocked physical unit (the business's "Master SKU");
-- physical inventory counts at this grain — sets (Full/Complete) are
-- pre-packed physical units, so a set is its own row. sku = the WMS
-- match key, mirroring the current master_product_sku spell
-- (maintained by the app's create/rename path); it is a label rendered
-- once at registration (may embed the triggering vehicle's f-number,
-- e.g. FM15113) — identity lives in the child's shape set, never
-- parsed from the sku string. Kind-specific detail lives in a 1:1
-- child (vehicle_shape_product); a part-grain item is a row with no
-- child. status: DRAFT = born inside a pending registration request
-- (vehicle_product_registration); its approval flips this to ACTIVE,
-- rejection deletes the draft (forensics in entity_log). Consumers
-- read ACTIVE only. Legacy imports are born ACTIVE with no
-- registration. CLOSEOUT = sold while stock lasts, never restocked.
CREATE TABLE master_product (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id UUID NOT NULL REFERENCES product_type(id),
    sku             TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT master_product_status_check
        CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSEOUT', 'DISCONTINUED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX master_product_product_type_id_idx
    ON master_product (product_type_id);


-- The fitment-product identity of a master_product: its shapes per
-- vehicle zone, in one material and one color. Zones are a fixed set,
-- so shapes sit in per-zone columns (an open zone set would be a new
-- product family, hence a new sibling table — not more columns here):
-- one filled = a row-level product, several = a pre-packed set (Full
-- Set = front + rear), exterior = a whole-vehicle car cover, alone by
-- CHECK. Row existence = the produced-combination catalog; identity is
-- the NULLS NOT DISTINCT unique (PG15+). A set-only vehicle registers
-- ONE product — no phantom row-level skus; loose-stock fulfilment of a
-- set is derived by matching its zone shapes to single-zone products
-- of the same material and color, not stored.
CREATE TABLE vehicle_shape_product (
    id                  UUID PRIMARY KEY DEFAULT uuidv7(),
    master_product_id   UUID NOT NULL UNIQUE REFERENCES master_product(id)
                        ON DELETE CASCADE,
    product_material_id UUID NOT NULL REFERENCES product_material(id),
    product_color_id    UUID NOT NULL REFERENCES product_color(id),
    exterior_shape_id   UUID REFERENCES vehicle_product_shape(id),
    front_shape_id      UUID REFERENCES vehicle_product_shape(id),
    rear_shape_id       UUID REFERENCES vehicle_product_shape(id),
    third_row_shape_id  UUID REFERENCES vehicle_product_shape(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_shape_product_shape_check
        CHECK (num_nonnulls(exterior_shape_id, front_shape_id,
                            rear_shape_id, third_row_shape_id) >= 1),
    CONSTRAINT vehicle_shape_product_exterior_check
        CHECK (exterior_shape_id IS NULL
               OR num_nonnulls(front_shape_id, rear_shape_id,
                               third_row_shape_id) = 0),
    -- auto-generated name (>63 bytes) → intent name
    CONSTRAINT vehicle_shape_product_identity_key
        UNIQUE NULLS NOT DISTINCT
        (exterior_shape_id, front_shape_id, rear_shape_id,
         third_row_shape_id, product_material_id, product_color_id)
);
CREATE INDEX vehicle_shape_product_product_material_id_idx
    ON vehicle_shape_product (product_material_id);

-- The part-grain identity of a master_product: one pattern (a design)
-- in one material and color — the orderable/shippable unit for
-- part-only flows: a fitment complaint ships ONLY the fixed part (the
-- design's new revision produces stock into this same master; the
-- finished-product master and its shape stay untouched), and
-- part-only factory orders book against it. Not a storefront SKU
-- (parts are not sold alone) but a full master product so WMS and
-- factory ordering can hold it — the live CA-PART-... masters are
-- these rows' migration source. Design grain, not part-dictionary
-- grain: what is ordered is "FH-HY-PA-BucC26-W in material 10, black";
-- the drawing is the design's current revision. A master_product ROW
-- carries exactly one identity KIND — cover XOR part, never both
-- (app-enforced, as with the design children); this bounds nothing
-- else: one finished cover coexists with as many part masters as its
-- parts × materials × colors need, each an independent master (two
-- misfitting parts on one seat cover = two part masters, two order
-- lines).
CREATE TABLE vehicle_part_product (
    id                        UUID PRIMARY KEY DEFAULT uuidv7(),
    master_product_id         UUID NOT NULL UNIQUE
        REFERENCES master_product(id) ON DELETE CASCADE,
    vehicle_product_design_id UUID NOT NULL
        REFERENCES vehicle_product_design(id),
    product_material_id       UUID NOT NULL REFERENCES product_material(id),
    product_color_id          UUID NOT NULL REFERENCES product_color(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated name (>63 bytes) → intent name
    CONSTRAINT vehicle_part_product_identity_key
        UNIQUE (vehicle_product_design_id, product_material_id,
                product_color_id)
);
CREATE INDEX vehicle_part_product_vehicle_product_design_id_idx
    ON vehicle_part_product (vehicle_product_design_id);
CREATE INDEX vehicle_part_product_product_material_id_idx
    ON vehicle_part_product (product_material_id);
CREATE INDEX vehicle_part_product_product_color_id_idx
    ON vehicle_part_product (product_color_id);
CREATE INDEX vehicle_shape_product_product_color_id_idx
    ON vehicle_shape_product (product_color_id);
-- FK support: the identity unique leads only on exterior
CREATE INDEX vehicle_shape_product_front_shape_id_idx
    ON vehicle_shape_product (front_shape_id);
CREATE INDEX vehicle_shape_product_rear_shape_id_idx
    ON vehicle_shape_product (rear_shape_id);
CREATE INDEX vehicle_shape_product_third_row_shape_id_idx
    ON vehicle_shape_product (third_row_shape_id);

-- A vehicle-product sku registration request — the approval event for
-- the vehicle cover domain (a future non-vehicle family gets its own
-- registration flow). One request batches the masters registered
-- together (the material×color combos picked on one screen); the PM
-- approves the request ONCE (§3.6 pair; NULL = pending), which flips
-- its masters DRAFT→ACTIVE in the same transaction (app-enforced
-- agreement). Rejection deletes the request,
-- its items, and the draft masters — forensics in entity_log.
-- Provenance lives per line: registration_item_x_vehicle_project names
-- each line's exact source projects (a full set line names two); no
-- rows = no project origin (a new color of an existing combination).
CREATE TABLE vehicle_product_registration (
    id           UUID PRIMARY KEY DEFAULT uuidv7(),
    requested_by UUID NOT NULL REFERENCES app_user(id),
    approved_at  TIMESTAMPTZ,
    approved_by  UUID REFERENCES app_user(id),
    title              TEXT,
                       -- the one line shown in the approval queue /
                       -- registration list ("2021-25 Palisade SC
                       -- lineup"); NULL = the screen synthesizes one
                       -- from the lines (auto-created registrations)
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_product_registration_approved_check
        CHECK ((approved_at IS NULL) = (approved_by IS NULL))
);
CREATE INDEX vehicle_product_registration_requested_by_idx
    ON vehicle_product_registration (requested_by);
CREATE INDEX vehicle_product_registration_approved_by_idx
    ON vehicle_product_registration (approved_by);

-- A line of a registration request: one master in the batch. A master
-- is born through exactly one request (UNIQUE) — legacy imports have
-- no line.
CREATE TABLE vehicle_product_registration_item (
    id                             UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_product_registration_id UUID NOT NULL
        REFERENCES vehicle_product_registration(id) ON DELETE CASCADE,
    master_product_id              UUID NOT NULL UNIQUE
        REFERENCES master_product(id) ON DELETE CASCADE,
    note                           TEXT,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- FK support: the UNIQUE above covers the master side
CREATE INDEX vehicle_product_registration_item_registration_id_idx
    ON vehicle_product_registration_item (vehicle_product_registration_id);

-- A source project of a registration line: which vehicle_projects this
-- line's master came from — exact, not the whole group (a 3-row
-- vehicle's full set names its front and rear projects only; a
-- row-level line names one); no rows = project-less registration.
-- Line shapes ⇔ named projects' shapes is app-enforced.
CREATE TABLE registration_item_x_vehicle_project (
    id                                   UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_product_registration_item_id UUID NOT NULL
        REFERENCES vehicle_product_registration_item(id) ON DELETE CASCADE,
    vehicle_project_id                   UUID NOT NULL
        REFERENCES vehicle_project(id),
    created_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated name (79 bytes) would exceed 63 → shortened per the
    -- header scheme
    CONSTRAINT registration_item_x_vehicle_project_item_id_project_id_key
        UNIQUE (vehicle_product_registration_item_id, vehicle_project_id)
);
CREATE INDEX registration_item_x_vehicle_project_vehicle_project_id_idx
    ON registration_item_x_vehicle_project (vehicle_project_id);


-- A packaging spec spell of a master_product: the carton/bag the
-- stocked unit ships in, over [valid_from, valid_to); valid_to NULL =
-- current, at most one per master_product. A packaging change closes
-- the spell and inserts a successor; only a correction updates in
-- place.
CREATE TABLE master_product_packaging (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    master_product_id UUID NOT NULL REFERENCES master_product(id)
                      ON DELETE CASCADE,
    length            NUMERIC(12,4) NOT NULL CHECK (length > 0),
    width             NUMERIC(12,4) NOT NULL CHECK (width > 0),
    height            NUMERIC(12,4) NOT NULL CHECK (height > 0),
    dimension_unit    TEXT NOT NULL
        CONSTRAINT master_product_packaging_dimension_unit_check
        CHECK (dimension_unit IN ('IN', 'CM')),
    weight            NUMERIC(12,4) NOT NULL CHECK (weight > 0),
    weight_unit       TEXT NOT NULL
        CONSTRAINT master_product_packaging_weight_unit_check
        CHECK (weight_unit IN ('LB', 'KG')),
    valid_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to          TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE UNIQUE INDEX master_product_packaging_current_key
    ON master_product_packaging (master_product_id)
    WHERE valid_to IS NULL;
-- FK support: the partial unique index above misses closed spells
CREATE INDEX master_product_packaging_master_product_id_idx
    ON master_product_packaging (master_product_id);

-- A sku spell of a master_product: one row per value it has carried,
-- over [valid_from, valid_to); valid_to NULL = current, mirrored on
-- master_product.sku by the app's create/rename path. A rename closes
-- the spell and inserts a successor; only a correction updates in
-- place. sku is unique across all rows: a value is never reused.
CREATE TABLE master_product_sku (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    master_product_id UUID NOT NULL REFERENCES master_product(id)
                      ON DELETE CASCADE,
    sku               TEXT NOT NULL UNIQUE,
    valid_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to          TIMESTAMPTZ,
    note              TEXT,   -- why this assignment exists
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE UNIQUE INDEX master_product_sku_current_key
    ON master_product_sku (master_product_id)
    WHERE valid_to IS NULL;
-- FK support: the partial unique index above misses closed spells
CREATE INDEX master_product_sku_master_product_id_idx
    ON master_product_sku (master_product_id);

-- Which part of the vehicle a product covers (seat rows; the exterior
-- for car covers), scoped per product type.
CREATE TABLE vehicle_zone (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id UUID NOT NULL REFERENCES product_type(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_type_id, code),
    UNIQUE (product_type_id, name)
);

-- A marketplace listing group: unique vehicles listed as one where
-- listing counts are capped (eBay). grouped_f_number = the charts'
-- 'A#####'; "grouped" repeats the table name, kept to stay distinct
-- from unique_vehicle.f_number.
CREATE TABLE unique_vehicle_group (
    id               UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id  UUID NOT NULL REFERENCES product_type(id),
    grouped_f_number TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_type_id, grouped_f_number)
);

-- The unique vehicle for a product type — one size-chart row: model +
-- year span + ordered fixed option values; the sellable fitment unit.
-- option_hash = md5 of the row's vehicle_option_value ids, sorted
-- ascending, '-'-joined ('' when optionless); maintained by the app.
-- A configuration change never edits a row: a revision retires it
-- (SUPERSEDED) and creates successors; f_numbers are never reused.
CREATE TABLE unique_vehicle (
    id                      UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id         UUID NOT NULL REFERENCES product_type(id),
    vehicle_model_id        UUID NOT NULL REFERENCES vehicle_model(id),
    unique_vehicle_group_id UUID REFERENCES unique_vehicle_group(id)
                            ON DELETE SET NULL,   -- set when sold as part of a grouped listing
    f_number                TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT unique_vehicle_status_check
        CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED')),
                            -- DRAFT = staged by a PENDING revision;
                            -- consumers read ACTIVE only
    year_start              SMALLINT NOT NULL,
    year_end                SMALLINT NOT NULL,
    option_hash             TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (year_start <= year_end),
    UNIQUE (product_type_id, f_number)
);
-- one live row per configuration: SUPERSEDED rows are excluded (a later
-- revision may re-create a retired configuration under a new f_number);
-- DRAFT rows participate.
CREATE UNIQUE INDEX unique_vehicle_identity_key
    ON unique_vehicle (product_type_id, vehicle_model_id, year_start,
                       year_end, option_hash)
    WHERE status <> 'SUPERSEDED';
CREATE INDEX unique_vehicle_vehicle_model_id_idx
    ON unique_vehicle (vehicle_model_id);
CREATE INDEX unique_vehicle_unique_vehicle_group_id_idx
    ON unique_vehicle (unique_vehicle_group_id);

-- An ordered option of a unique vehicle: option_key_display_order +
-- value; the key is reached through the value, not stored here.
CREATE TABLE unique_vehicle_x_option_value (
    id                       UUID PRIMARY KEY DEFAULT uuidv7(),
    unique_vehicle_id        UUID NOT NULL REFERENCES unique_vehicle(id) ON DELETE CASCADE,
    vehicle_option_value_id  UUID NOT NULL REFERENCES vehicle_option_value(id),
    option_key_display_order SMALLINT NOT NULL CHECK (option_key_display_order >= 1),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated names (76/75 bytes) would exceed 63 → shortened per
    -- the header scheme
    CONSTRAINT unique_vehicle_x_option_value_vehicle_id_display_order_key
        UNIQUE (unique_vehicle_id, option_key_display_order),
    CONSTRAINT unique_vehicle_x_option_value_vehicle_id_option_value_id_key
        UNIQUE (unique_vehicle_id, vehicle_option_value_id)
);
CREATE INDEX unique_vehicle_x_option_value_vehicle_option_value_id_idx
    ON unique_vehicle_x_option_value (vehicle_option_value_id);

-- Vehicle body dimensions of a unique vehicle, one row per source.
-- A chart range cell ('176.3-177.4') lands as min < max; a point value
-- stores min = max. Corrections UPDATE in place.
CREATE TABLE unique_vehicle_dimension (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    unique_vehicle_id UUID NOT NULL REFERENCES unique_vehicle(id)
                      ON DELETE CASCADE,
    source            TEXT NOT NULL
        CONSTRAINT unique_vehicle_dimension_source_check
        CHECK (source IN ('MEASURED', 'AI_ESTIMATED')),
    length_min        NUMERIC(12,4),
    length_max        NUMERIC(12,4),
    width_min         NUMERIC(12,4),
    width_max         NUMERIC(12,4),
    height_min        NUMERIC(12,4),
    height_max        NUMERIC(12,4),
    dimension_unit    TEXT NOT NULL
        CONSTRAINT unique_vehicle_dimension_dimension_unit_check
        CHECK (dimension_unit IN ('IN', 'CM')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unique_vehicle_id, source),
    CONSTRAINT unique_vehicle_dimension_length_check
        CHECK ((length_min IS NULL) = (length_max IS NULL)
           AND (length_min IS NULL
                OR (length_min > 0 AND length_max >= length_min))),
    CONSTRAINT unique_vehicle_dimension_width_check
        CHECK ((width_min IS NULL) = (width_max IS NULL)
           AND (width_min IS NULL
                OR (width_min > 0 AND width_max >= width_min))),
    CONSTRAINT unique_vehicle_dimension_height_check
        CHECK ((height_min IS NULL) = (height_max IS NULL)
           AND (height_min IS NULL
                OR (height_min > 0 AND height_max >= height_min))),
    CONSTRAINT unique_vehicle_dimension_nonempty_check
        CHECK (num_nonnulls(length_min, width_min, height_min) >= 1)
);

-- A catalog restructuring event (a split, a merge, a re-spec) with an
-- approval workflow. PENDING stages the change: predecessors stay
-- ACTIVE, successors are DRAFT. Approval is one transaction:
-- successors ACTIVE, predecessors SUPERSEDED. Rejection keeps
-- this row and deletes the staged members and DRAFT successors. The
-- proposer and rejecter are read from entity_log, not stored.
CREATE TABLE unique_vehicle_revision (
    id           UUID PRIMARY KEY DEFAULT uuidv7(),
    status       TEXT NOT NULL DEFAULT 'PENDING'
        CONSTRAINT unique_vehicle_revision_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    note         TEXT,   -- why this revision exists
    effective_at TIMESTAMPTZ,
                 -- when the change takes force in the catalog; set at
                 -- approval, backdating allowed
    approved_at  TIMESTAMPTZ,
    approved_by  UUID REFERENCES app_user(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_vehicle_revision_approved_by_check
        CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
    CONSTRAINT unique_vehicle_revision_approved_at_check
        CHECK ((status = 'APPROVED') = (approved_at IS NOT NULL)),
    CONSTRAINT unique_vehicle_revision_effective_at_check
        CHECK ((status = 'APPROVED') = (effective_at IS NOT NULL))
);
CREATE INDEX unique_vehicle_revision_approved_by_idx
    ON unique_vehicle_revision (approved_by);

-- A revision membership: one vehicle a revision touched, by type —
-- PREDECESSOR = retired by it, SUCCESSOR = created by it. Not a §2.2
-- junction: each type is a one-time, one-partner fact (partial uniques
-- below) — two folded one-to-many links owned by the revision workflow.
CREATE TABLE unique_vehicle_revision_member (
    id                         UUID PRIMARY KEY DEFAULT uuidv7(),
    unique_vehicle_revision_id UUID NOT NULL REFERENCES unique_vehicle_revision(id),
    unique_vehicle_id          UUID NOT NULL REFERENCES unique_vehicle(id),
    type                       TEXT NOT NULL
        CONSTRAINT unique_vehicle_revision_member_type_check
        CHECK (type IN ('PREDECESSOR', 'SUCCESSOR')),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated name (79 bytes) would exceed 63 → shortened per the
    -- header scheme; also blocks one vehicle taking both types in one revision
    CONSTRAINT unique_vehicle_revision_member_revision_id_vehicle_id_key
        UNIQUE (unique_vehicle_revision_id, unique_vehicle_id)
);
-- retirement and birth are one-time facts: a vehicle is PREDECESSOR in at
-- most one revision, and SUCCESSOR of at most one
CREATE UNIQUE INDEX unique_vehicle_revision_member_predecessor_key
    ON unique_vehicle_revision_member (unique_vehicle_id)
    WHERE type = 'PREDECESSOR';
CREATE UNIQUE INDEX unique_vehicle_revision_member_successor_key
    ON unique_vehicle_revision_member (unique_vehicle_id)
    WHERE type = 'SUCCESSOR';
-- FK support: the type-scoped partial uniques above can't serve an
-- un-scoped unique_vehicle_id lookup
CREATE INDEX unique_vehicle_revision_member_unique_vehicle_id_idx
    ON unique_vehicle_revision_member (unique_vehicle_id);

-- Lineage read model: one row per predecessor→successor pair of an
-- APPROVED revision; pending and rejected revisions are workflow, not
-- lineage.
CREATE VIEW unique_vehicle_lineage_view AS
SELECT r.id                AS unique_vehicle_revision_id,
       pv.product_type_id,
       p.unique_vehicle_id AS predecessor_unique_vehicle_id,
       pv.f_number         AS predecessor_f_number,
       s.unique_vehicle_id AS successor_unique_vehicle_id,
       sv.f_number         AS successor_f_number,
       r.note,
       r.effective_at,
       r.approved_by,
       r.created_at
FROM unique_vehicle_revision r
JOIN unique_vehicle_revision_member p
    ON p.unique_vehicle_revision_id = r.id AND p.type = 'PREDECESSOR'
JOIN unique_vehicle pv ON pv.id = p.unique_vehicle_id
JOIN unique_vehicle_revision_member s
    ON s.unique_vehicle_revision_id = r.id AND s.type = 'SUCCESSOR'
JOIN unique_vehicle sv ON sv.id = s.unique_vehicle_id
WHERE r.status = 'APPROVED';

-- A field-research vehicle: the same identity shape as unique_vehicle
-- but records R&D field work, not a sellable unit; the same spec may be
-- researched more than once.
CREATE TABLE vehicle_research (
    id               UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id  UUID NOT NULL REFERENCES product_type(id),
    vehicle_model_id UUID NOT NULL REFERENCES vehicle_model(id),
    year_start       SMALLINT NOT NULL,
    year_end         SMALLINT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (year_start <= year_end)
);
CREATE INDEX vehicle_research_product_type_id_idx
    ON vehicle_research (product_type_id);
CREATE INDEX vehicle_research_vehicle_model_id_idx
    ON vehicle_research (vehicle_model_id);

-- An option of a research vehicle: an unordered value set; the key is
-- reached through the value.
CREATE TABLE vehicle_research_x_option_value (
    id                      UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_research_id     UUID NOT NULL REFERENCES vehicle_research(id) ON DELETE CASCADE,
    vehicle_option_value_id UUID NOT NULL REFERENCES vehicle_option_value(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated name (79 bytes) would exceed 63 → shortened per the
    -- header scheme (lands at the 63-byte limit)
    CONSTRAINT vehicle_research_x_option_value_research_id_option_value_id_key
        UNIQUE (vehicle_research_id, vehicle_option_value_id)
);
CREATE INDEX vehicle_research_x_option_value_vehicle_option_value_id_idx
    ON vehicle_research_x_option_value (vehicle_option_value_id);

-- A shape assignment spell: unique_vehicle uses vehicle_product_shape at one
-- vehicle_zone over [valid_from, valid_to); valid_to NULL = current.
-- The only UPDATE is the close; changes insert a new row. type
-- ALTERNATIVE = an out-of-stock substitute, in substitution_priority
-- order.
CREATE TABLE unique_vehicle_x_shape_assignment (
    id                    UUID PRIMARY KEY DEFAULT uuidv7(),
    unique_vehicle_id     UUID NOT NULL REFERENCES unique_vehicle(id) ON DELETE CASCADE,
    vehicle_zone_id       UUID NOT NULL REFERENCES vehicle_zone(id),
    vehicle_product_shape_id      UUID NOT NULL REFERENCES vehicle_product_shape(id),
    type                  TEXT NOT NULL DEFAULT 'PRIMARY'
        CONSTRAINT unique_vehicle_x_shape_assignment_type_check
        CHECK (type IN ('PRIMARY', 'ALTERNATIVE')),
    substitution_priority SMALLINT CHECK (substitution_priority >= 1),
    valid_from            TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to              TIMESTAMPTZ,
    note                  TEXT,   -- why this assignment exists
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_vehicle_x_shape_assignment_type_priority_check
        CHECK ((type = 'PRIMARY') = (substitution_priority IS NULL)),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
-- blocks duplicate current spells; car cover EXTERIOR holds one
-- PRIMARY per material
CREATE UNIQUE INDEX unique_vehicle_x_shape_assignment_current_key
    ON unique_vehicle_x_shape_assignment
       (unique_vehicle_id, vehicle_zone_id, vehicle_product_shape_id)
    WHERE valid_to IS NULL;
-- FK support: the partial unique index above misses closed spells
CREATE INDEX unique_vehicle_x_shape_assignment_unique_vehicle_id_idx
    ON unique_vehicle_x_shape_assignment (unique_vehicle_id);
CREATE INDEX unique_vehicle_x_shape_assignment_vehicle_zone_id_idx
    ON unique_vehicle_x_shape_assignment (vehicle_zone_id);
CREATE INDEX unique_vehicle_x_shape_assignment_vehicle_product_shape_id_idx
    ON unique_vehicle_x_shape_assignment (vehicle_product_shape_id);


-- A seat cover pattern part kind (FA, FH, FMB, ...). is_custom = false
-- = the closed legacy set of universal one-pattern-fits-many parts
-- (FH-D, BT-D, ...); recurring fitment issues ended the approach.
CREATE TABLE seat_cover_part (
    id                 UUID PRIMARY KEY DEFAULT uuidv7(),
    name               TEXT NOT NULL UNIQUE,
    description        TEXT,
    vehicle_zone_id    UUID NOT NULL REFERENCES vehicle_zone(id),   -- the seat row it belongs to (no cross-zone parts)
    category           TEXT NOT NULL,   -- which piece of the seat (ARM, BOTTOM, HEADREST, ...); no CHECK: values are added without DDL
    is_for_middle_seat BOOLEAN NOT NULL DEFAULT FALSE,   -- the middle-seat variant of its category (FMB vs FB)
    is_custom          BOOLEAN NOT NULL DEFAULT TRUE,    -- false = legacy universal part (closed set)
    vehicle_product_design_id UUID UNIQUE,   -- universal parts only (is_custom = false ⇔ set, app-enforced):
                                      -- the part IS its own pattern; FK deferred below (mutual reference)
    status             TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT seat_cover_part_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX seat_cover_part_vehicle_zone_id_idx
    ON seat_cover_part (vehicle_zone_id);

-- A seat style code (424BEN, 46BENMEG, ...): one seat configuration,
-- deliberately year-free (the year rides in pattern names, so codes
-- don't multiply per model year). A different code space from
-- vehicle_product_shape's website size codes (F-31, ...).
CREATE TABLE seat_cover_code (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    code        TEXT NOT NULL UNIQUE,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT seat_cover_code_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The option values a seat style code encodes (424BEN → the '40/20/40
-- split-cushion bench' value, ...): ties codes to the option dictionary
-- so a code can be suggested from a research vehicle's options.
CREATE TABLE seat_cover_code_x_option_value (
    id                      UUID PRIMARY KEY DEFAULT uuidv7(),
    seat_cover_code_id      UUID NOT NULL REFERENCES seat_cover_code(id) ON DELETE CASCADE,
    vehicle_option_value_id UUID NOT NULL REFERENCES vehicle_option_value(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated name (77 bytes) would exceed 63 → shortened per the
    -- header scheme
    CONSTRAINT seat_cover_code_x_option_value_code_id_option_value_id_key
        UNIQUE (seat_cover_code_id, vehicle_option_value_id)
);
CREATE INDEX seat_cover_code_x_option_value_vehicle_option_value_id_idx
    ON seat_cover_code_x_option_value (vehicle_option_value_id);

-- A product design — the unit the sample loop runs on (stage 2 of the
-- flow: ready to send to the factory). Its substance varies by family
-- (SC/CC: a sewing pattern; FM: a scan-defined mold form) — kind
-- detail lives in a 1:1 child. Its composition
-- is exactly one of: seat_cover_design, car_cover_design, or a
-- universal part's vehicle_product_design_id link (app-enforced).
CREATE TABLE vehicle_product_design (
    id                 UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id    UUID NOT NULL REFERENCES product_type(id),
    -- rendered once by the app at creation, never regenerated (printed
    -- names must survive renames); master_product copies it as the
    -- initial sku at stock registration
    name               TEXT NOT NULL UNIQUE,
    status             TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT vehicle_product_design_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_product_design_product_type_id_idx
    ON vehicle_product_design (product_type_id);

-- The seat cover design: a sewing pattern — one part of one researched
-- vehicle, in one seat style code, for one side. A complaint forks on
-- the identity key — same combination = new revision, else new design.
CREATE TABLE seat_cover_design (
    id                  UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_product_design_id  UUID NOT NULL UNIQUE REFERENCES vehicle_product_design(id)
                        ON DELETE CASCADE,
    seat_cover_part_id  UUID NOT NULL REFERENCES seat_cover_part(id),
    vehicle_research_id UUID NOT NULL REFERENCES vehicle_research(id),
    seat_cover_code_id  UUID NOT NULL REFERENCES seat_cover_code(id),
    -- the pattern-name side tokens: D/P = per-side scan, U = fits both;
    -- a mirrored pair is MD/MP (the scanned side) + MD_E/MP_E (its
    -- mirror — no own scan, no revisions)
    side                TEXT NOT NULL
        CONSTRAINT seat_cover_design_side_check
        CHECK (side IN ('D', 'P', 'U', 'MD', 'MP', 'MD_E', 'MP_E')),
    designed_by         UUID NOT NULL REFERENCES app_user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated name (85 bytes) would exceed 63 → intent name
    CONSTRAINT seat_cover_design_identity_key
        UNIQUE (seat_cover_part_id, vehicle_research_id, seat_cover_code_id,
                side)
);
CREATE INDEX seat_cover_design_vehicle_research_id_idx
    ON seat_cover_design (vehicle_research_id);
CREATE INDEX seat_cover_design_seat_cover_code_id_idx
    ON seat_cover_design (seat_cover_code_id);
CREATE INDEX seat_cover_design_designed_by_idx
    ON seat_cover_design (designed_by);

-- The car cover design: a sewing pattern — the whole vehicle as one
-- piece — the research vehicle IS the identity (UNIQUE: one design per
-- research). No scan: the 3D model is purchased (a project asset).
CREATE TABLE car_cover_design (
    id                  UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_product_design_id  UUID NOT NULL UNIQUE REFERENCES vehicle_product_design(id)
                        ON DELETE CASCADE,
    vehicle_research_id UUID NOT NULL UNIQUE REFERENCES vehicle_research(id),
    designed_by         UUID NOT NULL REFERENCES app_user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX car_cover_design_designed_by_idx
    ON car_cover_design (designed_by);

-- The floor mat design: a scan-defined mold form — no drawing file
-- exists (the mold lives at the factory; the WeChat mold talk decides
-- it). One design per researched vehicle per zone (UNIQUE) — the mold
-- is LINE-FREE: design lines (Regular/Luxury/...) are surface patterns
-- applied ON the mold at production, a sellable-product axis, not a
-- form axis (field-confirmed; supersedes #025's per-line-mold
-- premise). A mold fix keeps the name and is a new revision (= a
-- rescan). A different option combination is a different research —
-- but a new design only per zone the differing option is RELEVANT to
-- (a console option splits S1, not S2/S3: same mold = same design,
-- 1:1). Relevance is the review's call; its verdict is recorded as
-- either a new design or an adopting project (adopted_project_id
-- points at the sibling project) (#022). Corollary: the option chain through
-- vehicle_research_id reads the birth research's FULL combination — a
-- superset of this zone's true conditions; the discriminating options
-- are read by comparing sibling designs. The part-number label's variation index
-- (S1-TT-SI03) is NOT stored: it is computed at render time — count of
-- existing designs for the Make+Model+zone + 1 (the variation index
-- counts MOLDS — floor-shape/option differences — never lines) — and
-- frozen
-- into the supertype name (a name-UNIQUE collision on concurrent
-- creates means recount). The design's option combination is NOT
-- stored either: it is the research's option rows, reached through
-- vehicle_research_id — valid because "different options = different
-- research = different design", and because the FM option dictionary
-- carries form-affecting keys only (a discipline; if catalog-only FM
-- options ever land there, a design↔option junction reopens). No
-- designed_by: no drawing act — the creator is entity_log's fact.
CREATE TABLE floor_mat_design (
    id                        UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_product_design_id UUID NOT NULL UNIQUE
        REFERENCES vehicle_product_design(id) ON DELETE CASCADE,
    vehicle_research_id       UUID NOT NULL REFERENCES vehicle_research(id),
    vehicle_zone_id           UUID NOT NULL REFERENCES vehicle_zone(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT floor_mat_design_research_id_zone_id_key
        UNIQUE (vehicle_research_id, vehicle_zone_id)
);
CREATE INDEX floor_mat_design_vehicle_zone_id_idx
    ON floor_mat_design (vehicle_zone_id);

-- Deferred FK for seat_cover_part.vehicle_product_design_id (mutual reference:
-- the part dictionary is created before the design core it links to).
ALTER TABLE seat_cover_part
    ADD CONSTRAINT seat_cover_part_vehicle_product_design_id_fkey
    FOREIGN KEY (vehicle_product_design_id) REFERENCES vehicle_product_design(id);

-- A design revision — the old naming's MMDDYY suffix as rows: the name
-- stays immutable, the app renders the display suffix from the latest
-- revision (revision 1 = the initial design). The revision's artifact
-- varies by family — SC/CC: the DXF, one required PATTERN_FILE asset
-- row; FM: the rescan (the project's scan assets; no drawing exists) —
-- both app-enforced.
CREATE TABLE vehicle_product_design_revision (
    id                 UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_product_design_id UUID NOT NULL REFERENCES vehicle_product_design(id),
    revision_number    SMALLINT NOT NULL CHECK (revision_number >= 1),
    note               TEXT,   -- what changed and why
    sample_approved_at TIMESTAMPTZ,   -- THIS revision's sample passed office
                                      -- check (§3.6 pair); a re-approval is
                                      -- the next revision's own record, never
                                      -- an overwrite. The design's current
                                      -- state = the latest revision's
                                      -- approval, derived
    sample_approved_by UUID REFERENCES app_user(id),
    created_by         UUID NOT NULL REFERENCES app_user(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_product_design_revision_sample_approved_check
        CHECK ((sample_approved_at IS NULL) = (sample_approved_by IS NULL)),
    -- auto-generated name (79 bytes) would exceed 63 → shortened per the
    -- header scheme
    CONSTRAINT vehicle_product_design_revision_design_id_revision_number_key
        UNIQUE (vehicle_product_design_id, revision_number)
);
CREATE INDEX vehicle_product_design_revision_created_by_idx
    ON vehicle_product_design_revision (created_by);
CREATE INDEX vehicle_product_design_revision_sample_approved_by_idx
    ON vehicle_product_design_revision (sample_approved_by);

-- One consolidated send to a factory (today: the WeChat message with
-- pattern-file and checklist links). sent_at NULL = still being assembled.
CREATE TABLE sample_request (
    id         UUID PRIMARY KEY DEFAULT uuidv7(),
    factory_id UUID NOT NULL REFERENCES factory(id),
    note       TEXT,
    sent_at    TIMESTAMPTZ,
    sent_by    UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sample_request_sent_check
        CHECK ((sent_at IS NULL) = (sent_by IS NULL))
);
CREATE INDEX sample_request_factory_id_idx
    ON sample_request (factory_id);
CREATE INDEX sample_request_sent_by_idx
    ON sample_request (sent_by);

-- One physical outbound of samples from a factory — the tracked leg
-- between "made" and "in hand". A shipment batches lines across
-- requests, and one request's lines may split across shipments; which
-- lines rode which shipment is the line's sample_shipment_id.
-- Milestones are nullable {verb}_at flags (§3.6): ready → shipped →
-- arrived; expected_arrival_date is the ETA and UPDATEs in place when
-- the factory revises it (history is entity_log's job). arrived_at =
-- the box landed; per-line receipt/inspection stays
-- sample_request_item.sample_received_at.
CREATE TABLE sample_shipment (
    id                    UUID PRIMARY KEY DEFAULT uuidv7(),
    factory_id            UUID NOT NULL REFERENCES factory(id),
    sample_ready_at       TIMESTAMPTZ,   -- factory reported production done
    shipped_at            TIMESTAMPTZ,
    expected_arrival_date DATE,
    arrived_at            TIMESTAMPTZ,
    shipment_reference    TEXT,   -- the factory's shipment identifier as
                                   -- given: B/L number, container number,
                                   -- courier tracking, AWB, ...
    note                  TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sample_shipment_arrived_check
        CHECK (arrived_at IS NULL OR shipped_at IS NOT NULL)
);
CREATE INDEX sample_shipment_factory_id_idx
    ON sample_shipment (factory_id);

-- A sample request line. Not a §2.2 junction (§2.1 line-item child):
-- today every line targets a design revision; a future target kind
-- becomes a nullable FK + num_nonnulls CHECK. A family whose lines
-- can't reduce to this shape (own payload) splits out as a sibling
-- table then — not before.
-- A line carries both design and revision: the revision = the
-- exact file sent (the old per-line 1st/2nd/3rd marks); for an E side
-- it is the scanned counterpart's revision, mirrored at the factory —
-- that divergence is the named need for carrying both references.
CREATE TABLE sample_request_item (
    id                          UUID PRIMARY KEY DEFAULT uuidv7(),
    sample_request_id           UUID NOT NULL REFERENCES sample_request(id) ON DELETE CASCADE,
    vehicle_product_design_id          UUID REFERENCES vehicle_product_design(id),
    vehicle_product_design_revision_id UUID REFERENCES vehicle_product_design_revision(id),
    sample_round                SMALLINT NOT NULL CHECK (sample_round >= 1),
    priority                    TEXT NOT NULL DEFAULT 'NORMAL'
        CONSTRAINT sample_request_item_priority_check
        CHECK (priority IN ('URGENT', 'NORMAL')),
    note                        TEXT,   -- the full per-line factory instruction (the old checklist doc's content)
    sample_received_at          TIMESTAMPTZ,   -- this round's sample arrived
    sample_shipment_id          UUID REFERENCES sample_shipment(id)
                                ON DELETE SET NULL,
                                -- the outbound this line rode; NULL = not
                                -- yet on a shipment. Shipment.factory =
                                -- request.factory is app-enforced (two-
                                -- parent agreement, §6)
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sample_request_item_target_check
        CHECK (vehicle_product_design_id IS NOT NULL),
                                -- every line targets a design; grows to a
                                -- num_nonnulls CHECK when a non-design
                                -- target kind arrives
    CONSTRAINT sample_request_item_revision_check
        CHECK ((vehicle_product_design_id IS NULL) = (vehicle_product_design_revision_id IS NULL))
);
-- (target, round) is globally unique: "design X's 3rd sample" happens
-- once, whichever request it rides — rounds are per-target counters,
-- not per-request. These also serve as the target FKs' supporting
-- indexes and subsume the old one-line-per-target-per-request rule.
CREATE UNIQUE INDEX sample_request_item_design_round_key
    ON sample_request_item (vehicle_product_design_id, sample_round)
    WHERE vehicle_product_design_id IS NOT NULL;
CREATE INDEX sample_request_item_vehicle_product_design_revision_id_idx
    ON sample_request_item (vehicle_product_design_revision_id);
CREATE INDEX sample_request_item_sample_shipment_id_idx
    ON sample_request_item (sample_shipment_id);



-- A vehicle project group: one whole vehicle's design for a product
-- type — row-based product types hold one member project per seat row.
-- The link to unique_vehicle (the f-number) is deliberately deferred.
CREATE TABLE vehicle_project_group (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id UUID NOT NULL REFERENCES product_type(id),
    status          TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT vehicle_project_group_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_project_group_product_type_id_idx
    ON vehicle_project_group (product_type_id);

-- A vehicle project: the design work for one vehicle zone of one
-- researched vehicle — or, research NULL, the seeded born record of a
-- legacy universal size (see the column note). The vehicle's
-- configuration lives on the research vehicle's options;
-- scan/photo/video folders are asset rows here.
-- Scan and fitting work are event rows (field_visit_x_vehicle_project,
-- typed) — the project keeps only the scan summary status.
CREATE TABLE vehicle_project (
    id                       UUID PRIMARY KEY DEFAULT uuidv7(),
    product_type_id          UUID NOT NULL REFERENCES product_type(id),
    vehicle_research_id      UUID REFERENCES vehicle_research(id),
                             -- the researched vehicle this work
                             -- targets. NULL = a universal project: a
                             -- born record of a legacy universal size
                             -- (targets no vehicle by definition; its
                             -- BOM is the size's composition, F-10 =
                             -- FH-D *2 + FT-N *2 + FB-N *2). The CHECK
                             -- below allows the NULL only on born
                             -- rows, so live work still requires a
                             -- researched vehicle — universal projects
                             -- can only be seeded complete, never
                             -- opened (no new universal sizes)
    vehicle_zone_id          UUID NOT NULL REFERENCES vehicle_zone(id),
    vehicle_product_shape_id         UUID REFERENCES vehicle_product_shape(id),
                             -- the shape this project's pattern work
                             -- is bearing / bore (one blueprint = one
                             -- shape, unique below). Set when pattern
                             -- work starts (the shape row is created
                             -- IN_DEVELOPMENT alongside it); the
                             -- FITTING task's DONE flips the shape ACTIVE.
                             -- NULL before pattern work, or when the
                             -- work ended in adopting an existing
                             -- shape instead (the abandoned row stays,
                             -- unlinked, IN_DEVELOPMENT — the shelf)
    adopted_project_id       UUID REFERENCES vehicle_project(id),
                             -- the EXISTING project whose product this
                             -- project's fitting confirmed instead of
                             -- bearing its own: what is adopted is that
                             -- project's work — its shape is one join
                             -- away (its vehicle_product_shape_id).
                             -- #032 makes the reference total: universal
                             -- sizes have seeded birth projects too.
                             -- Not unique — several projects may adopt
                             -- one. Same grammar as the try-on lane
                             -- (field_visit_x_vehicle_project.target_vehicle_research_id):
                             -- "referencing existing work" always
                             -- points at a project; a try-on PASS
                             -- carries its vehicle_project_id here
                             -- unchanged. Target must be a BIRTH
                             -- project (vehicle_product_shape_id NOT
                             -- NULL — no adopting an adopter, no
                             -- unborn targets; app-enforced at the
                             -- adoption gate, watch candidate). An
                             -- adopting project carries an empty BOM
                             -- (or a shelved one, see the shelf rule);
                             -- its verdict is the fitting's PASS.
                             -- Exclusive with vehicle_product_shape_id:
                             -- a project either births or adopts,
                             -- never both
    vehicle_project_group_id UUID REFERENCES vehicle_project_group(id)
                             ON DELETE SET NULL,
    status                   TEXT NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT vehicle_project_status_check
        CHECK (status IN ('ACTIVE', 'ON_HOLD', 'CANCELLED')),
                             -- administrative state, orthogonal to the
                             -- workflow position: ON_HOLD/CANCELLED are
                             -- pure declarations (a discontinued
                             -- vehicle, a dropped priority) derivable
                             -- from no event. No COMPLETED — completion
                             -- is the outcome columns' (shape/adopted),
                             -- stored nowhere else
    current_stage            TEXT,
                             -- the declared workflow position — no
                             -- CHECK: per-product-type vocabularies,
                             -- values added without DDL (task.type's
                             -- policy). Stored because rework makes the
                             -- position non-monotonic: after a FAILED
                             -- fitting the project is back in design
                             -- while its sample requests still exist,
                             -- so no event ladder can derive "where we
                             -- are now" — a declaration, not a cache.
                             -- Transitions ride existing app actions
                             -- (scan performed, gate closures, sample
                             -- request); a rework step-back is an
                             -- explicit declaration. Absorbs the old
                             -- scan_skipped: a no-scan project starts
                             -- past the scan stage (CC purchased 3D,
                             -- seeded universals start at a terminal
                             -- stage) — the starting stage IS the skip
                             -- declaration
    manager_id               UUID REFERENCES app_user(id),
                             -- the manager who runs this project — a
                             -- standing fact, not an event: tasks
                             -- record who requested each piece of work
                             -- (requested_by), but the project's owner
                             -- outlives any task. NULL on seeded
                             -- universal projects (no one runs a
                             -- record). A handover UPDATEs; history is
                             -- entity_log's
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_project_shape_outcome_check
        CHECK (num_nonnulls(vehicle_product_shape_id, adopted_project_id) <= 1),
    CONSTRAINT vehicle_project_research_or_born_check
        CHECK (vehicle_research_id IS NOT NULL
               OR vehicle_product_shape_id IS NOT NULL)
        -- a temporary guard, not a law: today a live project without a
        -- researched vehicle is always a bug (variation numbering,
        -- sibling diffs, option chains all read through research), so
        -- the NULL is admitted only on seeded born rows (legacy
        -- universal sizes). When a product family that targets no
        -- vehicle joins (steering wheel covers — sizes are developed,
        -- not fitted to a car), live vehicle-less work becomes
        -- legitimate: DROP this constraint as part of that family's
        -- joining migration
);
-- one blueprint = one shape: a shape has at most one bearing project
CREATE UNIQUE INDEX vehicle_project_vehicle_product_shape_id_key
    ON vehicle_project (vehicle_product_shape_id)
    WHERE vehicle_product_shape_id IS NOT NULL;
CREATE INDEX vehicle_project_product_type_id_idx
    ON vehicle_project (product_type_id);
CREATE INDEX vehicle_project_vehicle_research_id_idx
    ON vehicle_project (vehicle_research_id);
CREATE INDEX vehicle_project_vehicle_zone_id_idx
    ON vehicle_project (vehicle_zone_id);
CREATE INDEX vehicle_project_vehicle_project_group_id_idx
    ON vehicle_project (vehicle_project_group_id);
-- serves: "projects that adopted this project's product"; FK support
CREATE INDEX vehicle_project_adopted_project_id_idx
    ON vehicle_project (adopted_project_id);
-- serves: "my projects" (the manager's board); FK support
CREATE INDEX vehicle_project_manager_id_idx
    ON vehicle_project (manager_id);

-- A work assignment on a project's board: who was asked to do what.
-- Several rows per type are allowed (two scanners on one field visit,
-- split design work); a replacement UPDATEs assigned_to/assigned_at —
-- history is entity_log's.
CREATE TABLE vehicle_project_task (
    id                 UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_project_id UUID NOT NULL REFERENCES vehicle_project(id) ON DELETE CASCADE,
    type               TEXT NOT NULL,
                       -- SCAN, DESIGN, REVIEW, SAMPLE, FITTING,
                       -- REGISTER, ...; no CHECK: values are added
                       -- without DDL
    title              TEXT,
    status             TEXT NOT NULL DEFAULT 'OPEN',
                       -- the ASSIGNMENT's state (OPEN, ACCEPTED,
                       -- DONE, FAILED, CANCELLED, ... — no CHECK, same
                       -- policy as type). Closing statuses: DONE =
                       -- purpose achieved, FAILED = performed but
                       -- missed, CANCELLED = never performed. Outcome truth lives in the domain
                       -- tables (adoption, item results, sample
                       -- requests) — with TWO deliberate exceptions,
                       -- both closures-as-declarations: (1) DESIGN —
                       -- closing the design assignment IS the
                       -- designer's "ready to sample" declaration, so
                       -- the sample gate is read from the board: a
                       -- project may request samples when at least one
                       -- DESIGN task exists and none is not-DONE
                       -- (split work = several DESIGN tasks, all must
                       -- close); (2) FITTING — DONE is the fitter's
                       -- "the whole product fits" declaration (#047:
                       -- a partial or failed day closes FAILED), and
                       -- the shape-ACTIVE gate reads it (with the
                       -- W-08 duplicate-BOM check at that moment). 'DESIGN' and
                       -- 'DONE' are therefore contract literals —
                       -- spelled exactly, though unchecked. Reopening
                       -- a DONE DESIGN task closes the gate again for
                       -- NEW requests (in-flight requests stand). FM
                       -- has no design work: its gate is the scan
                       -- (a performed SCAN item, or a stage past scan),
                       -- app-enforced per family
    assigned_to        UUID REFERENCES app_user(id),
                       -- NULL = created but not yet assigned (a backlog
                       -- item waiting for an owner)
    assigned_at        TIMESTAMPTZ,
                       -- when the CURRENT assignee got it — set with
                       -- assigned_to, cleared with it; a reassignment
                       -- overwrites both (history is entity_log's).
                       -- created_at is the request, assigned_at the
                       -- allocation, closed_at the closure — three
                       -- separable events, three timestamps
    requested_by       UUID NOT NULL REFERENCES app_user(id),
    closed_at          TIMESTAMPTZ,
                       -- when the task was closed, whichever way:
                       -- DONE (purpose achieved), FAILED (performed
                       -- but the purpose missed — a fitting that
                       -- didn't fit, a scan that couldn't happen; the
                       -- follow-up is NEW work, not a retry of this
                       -- row), or CANCELLED (never performed). Set
                       -- with the closing status, cleared on reopen —
                       -- the gate's "since when" without entity_log
                       -- archaeology. DONE means achieved, never
                       -- merely attended
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_project_task_assigned_pair_check
        CHECK ((assigned_to IS NULL) = (assigned_at IS NULL)),
    CONSTRAINT vehicle_project_task_closed_assigned_check
        CHECK (closed_at IS NULL OR status = 'CANCELLED'
               OR assigned_to IS NOT NULL)
        -- DONE/FAILED need an owner (someone performed the work; the
        -- DESIGN gate reads DONE and an ownerless pass would have no
        -- one accountable) — CANCELLED may close an unassigned
        -- backlog item
);
CREATE INDEX vehicle_project_task_vehicle_project_id_idx
    ON vehicle_project_task (vehicle_project_id);
CREATE INDEX vehicle_project_task_assigned_to_idx
    ON vehicle_project_task (assigned_to);
CREATE INDEX vehicle_project_task_requested_by_idx
    ON vehicle_project_task (requested_by);

-- A field trip: one physical visit to wherever the vehicles are — a
-- partner dealership, a private owner's car, the office lot — on one
-- booking; what happens there lives in items (one trip often serves
-- several projects). priority = queue ordering (the old Priority Tab;
-- sample urgency lives on the request line). performed_at NULL =
-- booked, not yet done (§3.6); the pair is trip-level — booking a
-- a visit books the trip; an item not gotten to stays result NULL.
-- Trip files land as assets on the projects via their items' visits.
CREATE TABLE field_visit (
    id                 UUID PRIMARY KEY DEFAULT uuidv7(),
    dealership_id      UUID REFERENCES dealership(id),
                       -- the partner dealership, when the trip goes to
                       -- one; NULL = a non-dealership location (see
                       -- location_type) or a dealership not yet chosen
    location_type      TEXT NOT NULL DEFAULT 'DEALERSHIP'
        CONSTRAINT field_visit_location_type_check
        CHECK (location_type IN ('DEALERSHIP', 'OWNER_VEHICLE',
                                 'OFFICE', 'FACTORY', 'OTHER')),
                       -- the classification; the specifics of a
                       -- non-dealership location (address, "owner's
                       -- home") go in note
    priority           TEXT NOT NULL DEFAULT 'NORMAL'
        CONSTRAINT field_visit_priority_check
        CHECK (priority IN ('URGENT', 'NORMAL')),
    scheduled_at       TIMESTAMPTZ,   -- the booked trip (§3.6)
    performed_at       TIMESTAMPTZ,   -- the trip happened (§3.6)
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT field_visit_dealership_location_check
        CHECK (dealership_id IS NULL OR location_type = 'DEALERSHIP')
        -- a filled FK forces the type; the reverse (type DEALERSHIP,
        -- FK still empty) is allowed — a booking whose dealership
        -- isn't chosen yet
);
CREATE INDEX field_visit_dealership_id_idx
    ON field_visit (dealership_id);

-- One piece of work at a trip: a project × an action. type SCAN = a
-- 3D-scan session; type FITTING = a sample fitting (the old Fitting
-- List tab = all FITTING items). result = the verdict of a performed
-- FITTING item; the project's current verdict is its latest performed
-- FITTING item's result, and a refit is a new item on a new trip; who
-- recorded it lives in entity_log — the verdict maker is the visitor.
-- A PASS speaks for the item only: coverage varies — the first
-- fitting tries EVERY part, a refit tries only the parts whose new
-- revisions arrived (the shipment's contents ARE the coverage). The
-- project's full verification is NOT stored per part: it is the
-- FITTING task's DONE (#047 semantics — the fitter closes DONE only
-- when everything, this trip's parts plus previously passed ones,
-- fits; a partial day closes FAILED). Which part failed and why lives
-- in this row's note and in the failed part's follow-up revision —
-- prose for humans, not machine data (an event table is the upgrade
-- path if part-level failure analytics is ever needed).
-- target_vehicle_research_id: NULL = the project's own vehicle (a normal R&D
-- item). NOT NULL = an extension try-on: this project's product
-- fitted on another researched vehicle ("the 2027 looks like the 2026
-- project's product fits") — examining the candidate IS a research
-- (its option combo is the grounds; the diff against this project's
-- research is the evidence), but no project opens for it: a PASS
-- leaves research + this item + the assignment (via the catalog
-- pairing step) and nothing else; a FAIL opens the project on that
-- same research. #032 makes the anchor total: universal sizes have
-- seeded birth projects to hang these items on. A try-on verdict is
-- atomic in result; ALTERNATIVE assignments get their evidence the
-- same way (one item per substitute product tried). No unique on
-- (field_visit, project): one trip may try one project's product on several
-- candidate vehicles, or scan and fit the same project.
CREATE TABLE field_visit_x_vehicle_project (
    id                  UUID PRIMARY KEY DEFAULT uuidv7(),
    field_visit_id UUID NOT NULL REFERENCES field_visit(id) ON DELETE CASCADE,
    vehicle_project_id  UUID NOT NULL REFERENCES vehicle_project(id) ON DELETE CASCADE,
    type                TEXT NOT NULL
        CONSTRAINT field_visit_x_vehicle_project_type_check
        CHECK (type IN ('SCAN', 'FITTING')),
    target_vehicle_research_id  UUID REFERENCES vehicle_research(id),
    result              TEXT
        CONSTRAINT field_visit_x_vehicle_project_result_check
        CHECK (result IN ('PASS', 'FAIL')),   -- NULL = no verdict yet
    note                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT field_visit_x_vehicle_project_result_type_check
        CHECK (result IS NULL OR type = 'FITTING'),
    CONSTRAINT field_visit_x_vehicle_project_target_research_type_check
        CHECK (target_vehicle_research_id IS NULL OR type = 'FITTING')
);
CREATE INDEX field_visit_x_vehicle_project_field_visit_id_idx
    ON field_visit_x_vehicle_project (field_visit_id);
CREATE INDEX field_visit_x_vehicle_project_vehicle_project_id_idx
    ON field_visit_x_vehicle_project (vehicle_project_id);
-- serves: "existing products tried on this vehicle"; FK support
CREATE INDEX field_visit_x_vehicle_project_target_vehicle_research_id_idx
    ON field_visit_x_vehicle_project (target_vehicle_research_id);


-- One line of a vehicle project's bill of designs: a design composing
-- the design and its quantity (the chart's 'FH-J *2'; a car cover
-- project holds its one whole-vehicle design, quantity 1; a floor mat
-- project holds its zone's mold design).
CREATE TABLE project_x_product_design_item (
    id                   UUID PRIMARY KEY DEFAULT uuidv7(),
    vehicle_project_id   UUID NOT NULL REFERENCES vehicle_project(id) ON DELETE CASCADE,
    vehicle_product_design_id   UUID NOT NULL REFERENCES vehicle_product_design(id),
    quantity             INTEGER NOT NULL CHECK (quantity > 0),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- auto-generated name (72 bytes) would exceed 63 → shortened per the
    -- header scheme
    CONSTRAINT project_x_product_design_item_project_id_design_id_key
        UNIQUE (vehicle_project_id, vehicle_product_design_id)
);
CREATE INDEX project_x_product_design_item_vehicle_product_design_id_idx
    ON project_x_product_design_item (vehicle_product_design_id);

-- One timeline entry on a domain entity: SYSTEM_LOG (a recorded
-- action) or USER_COMMENT (staff-authored; updated_at > created_at =
-- edited). entity_type + entity_id is a polymorphic reference (no FK).
CREATE TABLE activity (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    entity_type TEXT NOT NULL
        CONSTRAINT activity_entity_type_check
        CHECK (entity_type IN ('UNIQUE_VEHICLE', 'UNIQUE_VEHICLE_GROUP',
                               'VEHICLE_MODEL', 'VEHICLE_PRODUCT_SHAPE',
                               'VEHICLE_RESEARCH', 'VEHICLE_PROJECT',
                               'VEHICLE_PRODUCT_DESIGN_REVISION',
                               'SAMPLE_REQUEST', 'SAMPLE_SHIPMENT',
                               'FACTORY', 'DEALERSHIP')),
    entity_id   UUID NOT NULL,   -- the target row's id
    type        TEXT NOT NULL
        CONSTRAINT activity_type_check
        CHECK (type IN ('USER_COMMENT', 'SYSTEM_LOG')),
    message     TEXT NOT NULL CHECK (btrim(message) <> ''),
    logged_by   UUID NOT NULL REFERENCES app_user(id),   -- jobs and imports act as the seeded system user
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- serves: per-entity timeline feed
CREATE INDEX activity_entity_type_entity_id_idx
    ON activity (entity_type, entity_id);
CREATE INDEX activity_logged_by_idx
    ON activity (logged_by);

-- A user mentioned in a USER_COMMENT: the queryable extraction of the
-- message's <@app_user.id> tokens; the message is the source.
CREATE TABLE activity_mention (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    activity_id UUID NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
    app_user_id UUID NOT NULL REFERENCES app_user(id),   -- the mentioned user
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_id, app_user_id)
);
CREATE INDEX activity_mention_app_user_id_idx
    ON activity_mention (app_user_id);

-- Asset category dictionary, scoped per entity type (research: scan,
-- photo, ...; shape: pattern, drawing, ...).
CREATE TABLE asset_type (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    entity_type TEXT NOT NULL
        CONSTRAINT asset_type_entity_type_check
        CHECK (entity_type IN ('UNIQUE_VEHICLE', 'UNIQUE_VEHICLE_GROUP',
                               'VEHICLE_MODEL', 'VEHICLE_PRODUCT_SHAPE',
                               'VEHICLE_RESEARCH', 'VEHICLE_PROJECT',
                               'VEHICLE_PRODUCT_DESIGN_REVISION',
                               'SAMPLE_REQUEST', 'SAMPLE_SHIPMENT',
                               'FACTORY', 'DEALERSHIP')),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_type, name)
);

-- A file or link on a domain entity — an S3 upload, or a pasted NAS
-- path / Drive link / web URL. asset_type_id NULL = uncategorized;
-- activity_id = the comment it arrived with (NULL = attached directly).
CREATE TABLE asset (
    id            UUID PRIMARY KEY DEFAULT uuidv7(),
    entity_type   TEXT NOT NULL
        CONSTRAINT asset_entity_type_check
        CHECK (entity_type IN ('UNIQUE_VEHICLE', 'UNIQUE_VEHICLE_GROUP',
                               'VEHICLE_MODEL', 'VEHICLE_PRODUCT_SHAPE',
                               'VEHICLE_RESEARCH', 'VEHICLE_PROJECT',
                               'VEHICLE_PRODUCT_DESIGN_REVISION',
                               'SAMPLE_REQUEST', 'SAMPLE_SHIPMENT',
                               'FACTORY', 'DEALERSHIP')),
    entity_id     UUID NOT NULL,   -- the target row's id
    asset_type_id UUID REFERENCES asset_type(id),
    activity_id   UUID REFERENCES activity(id)
                  ON DELETE SET NULL,   -- comment deletion keeps the file on the entity
    source        TEXT NOT NULL
        CONSTRAINT asset_source_check
        CHECK (source IN ('S3', 'NAS', 'GOOGLE_DRIVE', 'WEB')),
    s3_key        TEXT UNIQUE,   -- app-generated at presign
    path          TEXT,          -- as pasted: a NAS UNC path, a Drive link, or a web URL
    status        TEXT NOT NULL DEFAULT 'PENDING'
        CONSTRAINT asset_status_check
        CHECK (status IN ('PENDING', 'AVAILABLE')),
                  -- PENDING = upload in flight, not yet confirmed;
                  -- references are born AVAILABLE
    name          TEXT,   -- S3: original upload file name; references: optional label
    content_type  TEXT,   -- set at upload confirm; NULL on references
    byte_size     BIGINT CHECK (byte_size > 0),   -- set at upload confirm; NULL on references
    uploaded_by   UUID NOT NULL REFERENCES app_user(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT asset_source_locator_check
        CHECK ((source = 'S3') = (s3_key IS NOT NULL)
           AND (source = 'S3') = (path IS NULL)),
    CONSTRAINT asset_reference_status_check
        CHECK (source = 'S3' OR status = 'AVAILABLE'),
    CONSTRAINT asset_s3_name_check
        CHECK (source <> 'S3' OR name IS NOT NULL),
    CONSTRAINT asset_s3_available_check
        CHECK (source <> 'S3' OR status <> 'AVAILABLE'
               OR (byte_size IS NOT NULL AND content_type IS NOT NULL))
);
-- serves: per-entity file list
CREATE INDEX asset_entity_type_entity_id_idx
    ON asset (entity_type, entity_id);
CREATE INDEX asset_asset_type_id_idx
    ON asset (asset_type_id);
CREATE INDEX asset_activity_id_idx
    ON asset (activity_id);
CREATE INDEX asset_uploaded_by_idx
    ON asset (uploaded_by);

-- An in-app inbox entry for one recipient about one source event;
-- source_type names the event kind (MENTION → activity). read_at
-- NULL = unread. One row per (recipient, kind, source): a repeat event
-- re-opens the row (read_at back to NULL) instead of inserting a
-- second one.
CREATE TABLE notification (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    app_user_id UUID NOT NULL REFERENCES app_user(id),   -- the recipient
    source_type TEXT NOT NULL
        CONSTRAINT notification_source_type_check
        CHECK (source_type IN ('MENTION')),
    source_id   UUID NOT NULL,   -- the source row's id
    message     TEXT NOT NULL CHECK (btrim(message) <> ''),
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (app_user_id, source_type, source_id)
);
-- serves: source-side lookup and cleanup when a source row is deleted
CREATE INDEX notification_source_type_source_id_idx
    ON notification (source_type, source_id);

-- Internal forensic change log — one row per INSERT/UPDATE/DELETE on
-- every other table, written by trg_{table}_entity_log.
-- entity_type carries upper(TG_TABLE_NAME), no CHECK. changed_by NULL =
-- a write outside the app path; jobs and imports act as the seeded
-- SYSTEM user.
CREATE TABLE entity_log (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    entity_type TEXT NOT NULL,
    entity_id   UUID NOT NULL,   -- the target row's id
    action      TEXT NOT NULL
        CONSTRAINT entity_log_action_check
        CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data    JSONB,   -- full row image; NULL on INSERT
    new_data    JSONB,   -- full row image; NULL on DELETE
    changed_by  UUID REFERENCES app_user(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- serves: per-entity change history lookup
CREATE INDEX entity_log_entity_type_entity_id_idx
    ON entity_log (entity_type, entity_id);
CREATE INDEX entity_log_changed_by_idx
    ON entity_log (changed_by);

-- Maintains updated_at; a no-op UPDATE leaves it untouched.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF to_jsonb(OLD) - 'updated_at' <> to_jsonb(NEW) - 'updated_at' THEN
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END $$;

-- Writes one entity_log row per data change; no-op updates are not
-- logged. The actor arrives as the transaction-local GUC app.actor_id,
-- set by the application at the start of each write transaction
-- (SELECT set_config('app.actor_id', <app_user.id>, true)); unset or
-- blank reads as NULL.
CREATE FUNCTION capture_entity_log() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    actor UUID := NULLIF(current_setting('app.actor_id', true), '')::uuid;
BEGIN
    IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = to_jsonb(NEW) THEN
        RETURN NULL;
    END IF;
    INSERT INTO entity_log
        (entity_type, entity_id, action, old_data, new_data, changed_by)
    VALUES
        (upper(TG_TABLE_NAME),
         CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
         TG_OP,
         CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
         CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
         actor);
    RETURN NULL;
END $$;

-- updated_at maintenance — every table.
CREATE TRIGGER trg_product_type_set_updated_at
    BEFORE UPDATE ON product_type
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_department_set_updated_at
    BEFORE UPDATE ON department
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_app_user_set_updated_at
    BEFORE UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_make_set_updated_at
    BEFORE UPDATE ON vehicle_make
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_class_set_updated_at
    BEFORE UPDATE ON vehicle_class
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_model_set_updated_at
    BEFORE UPDATE ON vehicle_model
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_option_key_set_updated_at
    BEFORE UPDATE ON vehicle_option_key
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_option_value_set_updated_at
    BEFORE UPDATE ON vehicle_option_value
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_product_shape_set_updated_at
    BEFORE UPDATE ON vehicle_product_shape
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_material_set_updated_at
    BEFORE UPDATE ON product_material
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_color_set_updated_at
    BEFORE UPDATE ON product_color
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_master_product_set_updated_at
    BEFORE UPDATE ON master_product
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_shape_product_set_updated_at
    BEFORE UPDATE ON vehicle_shape_product
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_part_product_set_updated_at
    BEFORE UPDATE ON vehicle_part_product
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_product_registration_set_updated_at
    BEFORE UPDATE ON vehicle_product_registration
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_product_registration_item_set_updated_at
    BEFORE UPDATE ON vehicle_product_registration_item
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_registration_item_x_vehicle_project_set_updated_at
    BEFORE UPDATE ON registration_item_x_vehicle_project
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_master_product_packaging_set_updated_at
    BEFORE UPDATE ON master_product_packaging
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_master_product_sku_set_updated_at
    BEFORE UPDATE ON master_product_sku
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_zone_set_updated_at
    BEFORE UPDATE ON vehicle_zone
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unique_vehicle_group_set_updated_at
    BEFORE UPDATE ON unique_vehicle_group
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unique_vehicle_set_updated_at
    BEFORE UPDATE ON unique_vehicle
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unique_vehicle_x_option_value_set_updated_at
    BEFORE UPDATE ON unique_vehicle_x_option_value
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unique_vehicle_dimension_set_updated_at
    BEFORE UPDATE ON unique_vehicle_dimension
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unique_vehicle_revision_set_updated_at
    BEFORE UPDATE ON unique_vehicle_revision
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unique_vehicle_revision_member_set_updated_at
    BEFORE UPDATE ON unique_vehicle_revision_member
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_research_set_updated_at
    BEFORE UPDATE ON vehicle_research
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_research_x_option_value_set_updated_at
    BEFORE UPDATE ON vehicle_research_x_option_value
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_unique_vehicle_x_shape_assignment_set_updated_at
    BEFORE UPDATE ON unique_vehicle_x_shape_assignment
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_seat_cover_part_set_updated_at
    BEFORE UPDATE ON seat_cover_part
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_seat_cover_code_set_updated_at
    BEFORE UPDATE ON seat_cover_code
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_seat_cover_code_x_option_value_set_updated_at
    BEFORE UPDATE ON seat_cover_code_x_option_value
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_product_design_set_updated_at
    BEFORE UPDATE ON vehicle_product_design
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_seat_cover_design_set_updated_at
    BEFORE UPDATE ON seat_cover_design
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_car_cover_design_set_updated_at
    BEFORE UPDATE ON car_cover_design
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_floor_mat_design_set_updated_at
    BEFORE UPDATE ON floor_mat_design
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_product_design_revision_set_updated_at
    BEFORE UPDATE ON vehicle_product_design_revision
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_factory_set_updated_at
    BEFORE UPDATE ON factory
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dealership_set_updated_at
    BEFORE UPDATE ON dealership
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sample_request_set_updated_at
    BEFORE UPDATE ON sample_request
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sample_request_item_set_updated_at
    BEFORE UPDATE ON sample_request_item
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sample_shipment_set_updated_at
    BEFORE UPDATE ON sample_shipment
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_project_group_set_updated_at
    BEFORE UPDATE ON vehicle_project_group
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_project_set_updated_at
    BEFORE UPDATE ON vehicle_project
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_project_task_set_updated_at
    BEFORE UPDATE ON vehicle_project_task
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_field_visit_set_updated_at
    BEFORE UPDATE ON field_visit
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_field_visit_x_vehicle_project_set_updated_at
    BEFORE UPDATE ON field_visit_x_vehicle_project
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_project_x_product_design_item_set_updated_at
    BEFORE UPDATE ON project_x_product_design_item
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_activity_set_updated_at
    BEFORE UPDATE ON activity
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_activity_mention_set_updated_at
    BEFORE UPDATE ON activity_mention
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_asset_type_set_updated_at
    BEFORE UPDATE ON asset_type
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_asset_set_updated_at
    BEFORE UPDATE ON asset
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notification_set_updated_at
    BEFORE UPDATE ON notification
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_entity_log_set_updated_at
    BEFORE UPDATE ON entity_log
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Change capture — every table except entity_log itself (self-capture
-- would recurse).
CREATE TRIGGER trg_product_type_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON product_type
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_department_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON department
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_app_user_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON app_user
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_make_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_make
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_class_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_class
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_model_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_model
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_option_key_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_option_key
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_option_value_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_option_value
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_product_shape_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_product_shape
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_product_material_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON product_material
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_product_color_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON product_color
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_master_product_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON master_product
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_shape_product_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_shape_product
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_part_product_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_part_product
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_product_registration_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_product_registration
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_product_registration_item_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_product_registration_item
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_registration_item_x_vehicle_project_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON registration_item_x_vehicle_project
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_master_product_packaging_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON master_product_packaging
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_master_product_sku_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON master_product_sku
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_zone_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_zone
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_unique_vehicle_group_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON unique_vehicle_group
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_unique_vehicle_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON unique_vehicle
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_unique_vehicle_x_option_value_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON unique_vehicle_x_option_value
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_unique_vehicle_dimension_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON unique_vehicle_dimension
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_unique_vehicle_revision_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON unique_vehicle_revision
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_unique_vehicle_revision_member_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON unique_vehicle_revision_member
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_research_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_research
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_research_x_option_value_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_research_x_option_value
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_unique_vehicle_x_shape_assignment_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON unique_vehicle_x_shape_assignment
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_seat_cover_part_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON seat_cover_part
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_seat_cover_code_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON seat_cover_code
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_seat_cover_code_x_option_value_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON seat_cover_code_x_option_value
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_product_design_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_product_design
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_seat_cover_design_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON seat_cover_design
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_car_cover_design_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON car_cover_design
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_floor_mat_design_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON floor_mat_design
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_product_design_revision_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_product_design_revision
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_factory_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON factory
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_dealership_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON dealership
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_sample_request_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON sample_request
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_sample_request_item_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON sample_request_item
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_sample_shipment_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON sample_shipment
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_project_group_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_project_group
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_project_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_project
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_vehicle_project_task_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_project_task
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_field_visit_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON field_visit
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_field_visit_x_vehicle_project_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON field_visit_x_vehicle_project
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_project_x_product_design_item_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON project_x_product_design_item
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_activity_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON activity
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_activity_mention_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON activity_mention
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_asset_type_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON asset_type
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_asset_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON asset
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();
CREATE TRIGGER trg_notification_entity_log
    AFTER INSERT OR UPDATE OR DELETE ON notification
    FOR EACH ROW EXECUTE FUNCTION capture_entity_log();