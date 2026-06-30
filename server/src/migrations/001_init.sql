-- ============================================================================
-- 001_init.sql
-- 面料推荐数据库 — 22 张表初始 schema
-- 数据库：mianliao
-- ============================================================================

-- 启用快照隔离（避免读写阻塞）
ALTER DATABASE mianliao SET ALLOW_SNAPSHOT_ISOLATION ON;
GO

-- ---------- 1. roles ----------
IF OBJECT_ID('roles', 'U') IS NULL
CREATE TABLE roles (
  id           INT IDENTITY PRIMARY KEY,
  code         NVARCHAR(32)  NOT NULL UNIQUE,
  name_zh      NVARCHAR(64)  NOT NULL,
  description  NVARCHAR(255) NULL,
  created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ---------- 2. users ----------
IF OBJECT_ID('users', 'U') IS NULL
CREATE TABLE users (
  id              UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  username        NVARCHAR(64)      NOT NULL UNIQUE,
  password_hash   NVARCHAR(255)     NOT NULL,
  display_name    NVARCHAR(64)      NULL,
  email           NVARCHAR(128)     NULL,
  is_active       BIT               NOT NULL DEFAULT 1,
  last_login_at   DATETIME2         NULL,
  created_at      DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at      DATETIME2         NULL
);
GO

IF OBJECT_ID('user_roles', 'U') IS NULL
CREATE TABLE user_roles (
  user_id  UNIQUEIDENTIFIER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role_id  INT              NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
GO

IF OBJECT_ID('refresh_tokens', 'U') IS NULL
CREATE TABLE refresh_tokens (
  id           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  user_id      UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   CHAR(64)         NOT NULL UNIQUE,
  expires_at   DATETIME2        NOT NULL,
  revoked_at   DATETIME2        NULL,
  created_at   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens(user_id, expires_at DESC);
GO

-- ---------- 3. categories ----------
IF OBJECT_ID('categories', 'U') IS NULL
CREATE TABLE categories (
  code         NVARCHAR(32)  NOT NULL PRIMARY KEY,
  name_zh      NVARCHAR(64)  NOT NULL,
  description  NVARCHAR(255) NULL,
  sort_order   INT           NOT NULL DEFAULT 0
);
GO

-- ---------- 4. suppliers ----------
IF OBJECT_ID('suppliers', 'U') IS NULL
CREATE TABLE suppliers (
  id           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  name         NVARCHAR(128)    NOT NULL UNIQUE,
  short_name   NVARCHAR(32)     NULL,
  phone        NVARCHAR(32)     NULL,
  email        NVARCHAR(128)    NULL,
  address      NVARCHAR(255)    NULL,
  notes        NVARCHAR(MAX)    NULL,
  is_active    BIT              NOT NULL DEFAULT 1,
  created_at   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at   DATETIME2        NULL
);
GO

-- ---------- 5-9. 字典 ----------
IF OBJECT_ID('weaves', 'U') IS NULL
CREATE TABLE weaves (
  id          INT IDENTITY PRIMARY KEY,
  code        NVARCHAR(64) NOT NULL UNIQUE,
  name_zh     NVARCHAR(64) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('seasons', 'U') IS NULL
CREATE TABLE seasons (
  id          INT IDENTITY PRIMARY KEY,
  code        NVARCHAR(16) NOT NULL UNIQUE,
  name_zh     NVARCHAR(16) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('garment_styles', 'U') IS NULL
CREATE TABLE garment_styles (
  id          INT IDENTITY PRIMARY KEY,
  code        NVARCHAR(32) NOT NULL UNIQUE,
  name_zh     NVARCHAR(32) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('feature_tags', 'U') IS NULL
CREATE TABLE feature_tags (
  id          INT IDENTITY PRIMARY KEY,
  code        NVARCHAR(32) NOT NULL UNIQUE,
  name_zh     NVARCHAR(32) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('finishes', 'U') IS NULL
CREATE TABLE finishes (
  id          INT IDENTITY PRIMARY KEY,
  code        NVARCHAR(32) NOT NULL UNIQUE,
  name_zh     NVARCHAR(32) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0
);
GO

-- ---------- 10. fabrics 主表 ----------
IF OBJECT_ID('fabrics', 'U') IS NULL
CREATE TABLE fabrics (
  id                       NVARCHAR(32)      NOT NULL PRIMARY KEY,  -- 保留现有 12 字符串 md5 前缀
  code                     NVARCHAR(64)      NULL,
  name                     NVARCHAR(128)     NOT NULL,
  category_code            NVARCHAR(32)      NOT NULL REFERENCES categories(code),
  supplier_id              UNIQUEIDENTIFIER  NOT NULL REFERENCES suppliers(id),
  supplier_brand           NVARCHAR(64)      NULL,
  composition_raw          NVARCHAR(255)     NULL,
  spec_raw                 NVARCHAR(64)      NULL,
  weave_code               NVARCHAR(64)      NULL,
  structure                NVARCHAR(64)      NULL,
  finish_raw               NVARCHAR(64)      NULL,
  width_cm                 INT               NULL,
  weight_gsm               INT               NULL,
  weight_range_min         INT               NULL,
  weight_range_max         INT               NULL,
  texture                  NVARCHAR(64)      NULL,
  color                    NVARCHAR(64)      NULL,
  flame_retardant          BIT               NOT NULL DEFAULT 0,
  fr_standard              NVARCHAR(64)      NULL,
  edge                     NVARCHAR(64)      NULL,
  moq                      NVARCHAR(32)      NULL,
  fob_usd_per_m            DECIMAL(10,2)     NULL,
  price_rmb_per_m          DECIMAL(10,2)     NULL,
  -- 钉钉 AI 表新增字段
  season_codes             NVARCHAR(64)      NULL,
  recommended_style_codes  NVARCHAR(255)     NULL,
  selling_points           NVARCHAR(MAX)     NULL,
  similar_fabric_ids       NVARCHAR(MAX)     NULL,
  notes                    NVARCHAR(MAX)     NULL,
  -- 元数据
  source_file              NVARCHAR(255)     NULL,
  source_row               INT               NULL,
  imported_at              DATETIME2         NULL,
  -- 通用
  status                   NVARCHAR(16)      NOT NULL DEFAULT 'active',
  is_deleted               BIT               NOT NULL DEFAULT 0,
  created_at               DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at               DATETIME2         NULL,
  created_by               NVARCHAR(64)      NULL,
  updated_by               NVARCHAR(64)      NULL
);
GO

CREATE INDEX ix_fabrics_code       ON fabrics(code) WHERE code IS NOT NULL;
CREATE INDEX ix_fabrics_list       ON fabrics(is_deleted, status, category_code, updated_at DESC);
CREATE INDEX ix_fabrics_supplier   ON fabrics(supplier_id);
CREATE INDEX ix_fabrics_weight     ON fabrics(weight_gsm);
CREATE INDEX ix_fabrics_price      ON fabrics(price_rmb_per_m);
GO

-- ---------- 11. fabric_compositions ----------
IF OBJECT_ID('fabric_compositions', 'U') IS NULL
CREATE TABLE fabric_compositions (
  fabric_id   NVARCHAR(32)     NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  fiber_code  NVARCHAR(32)     NOT NULL,
  percentage  DECIMAL(5,2)     NOT NULL,
  PRIMARY KEY (fabric_id, fiber_code)
);
GO

-- ---------- 12. fabric_images ----------
IF OBJECT_ID('fabric_images', 'U') IS NULL
CREATE TABLE fabric_images (
  id           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  fabric_id    NVARCHAR(32)     NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  url          NVARCHAR(512)    NOT NULL,
  alt          NVARCHAR(128)    NULL,
  sort_order   INT              NOT NULL DEFAULT 0,
  is_cover     BIT              NOT NULL DEFAULT 0,
  source       NVARCHAR(16)     NOT NULL DEFAULT 'archive',
  sha1_8       CHAR(8)          NULL,
  created_at   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_fabric_images_fabric ON fabric_images(fabric_id, is_cover DESC, sort_order);
GO

-- ---------- 13-16. fabric 多对多子表 ----------
IF OBJECT_ID('fabric_finishes', 'U') IS NULL
CREATE TABLE fabric_finishes (
  fabric_id   NVARCHAR(32) NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  finish_code NVARCHAR(32) NOT NULL REFERENCES finishes(code) ON DELETE CASCADE,
  PRIMARY KEY (fabric_id, finish_code)
);
GO

IF OBJECT_ID('fabric_seasons', 'U') IS NULL
CREATE TABLE fabric_seasons (
  fabric_id   NVARCHAR(32) NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  season_code NVARCHAR(16) NOT NULL REFERENCES seasons(code) ON DELETE CASCADE,
  PRIMARY KEY (fabric_id, season_code)
);
GO

IF OBJECT_ID('fabric_garment_styles', 'U') IS NULL
CREATE TABLE fabric_garment_styles (
  fabric_id          NVARCHAR(32) NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  garment_style_code NVARCHAR(32) NOT NULL REFERENCES garment_styles(code) ON DELETE CASCADE,
  PRIMARY KEY (fabric_id, garment_style_code)
);
GO

IF OBJECT_ID('fabric_feature_tags', 'U') IS NULL
CREATE TABLE fabric_feature_tags (
  fabric_id         NVARCHAR(32) NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  feature_tag_code  NVARCHAR(32) NOT NULL REFERENCES feature_tags(code) ON DELETE CASCADE,
  PRIMARY KEY (fabric_id, feature_tag_code)
);
GO

-- ---------- 17. supplier_quotes ----------
IF OBJECT_ID('supplier_quotes', 'U') IS NULL
CREATE TABLE supplier_quotes (
  id               UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  fabric_id        NVARCHAR(32)     NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  supplier_name    NVARCHAR(128)    NOT NULL,
  price_rmb_per_m  DECIMAL(10,2)    NULL,
  moq              NVARCHAR(32)     NULL,
  phone            NVARCHAR(32)     NULL,
  email            NVARCHAR(128)    NULL,
  sort_order       INT              NOT NULL DEFAULT 0
);
CREATE INDEX ix_supplier_quotes_fabric ON supplier_quotes(fabric_id, sort_order);
GO

-- ---------- 18. style_notes ----------
IF OBJECT_ID('style_notes', 'U') IS NULL
CREATE TABLE style_notes (
  id                  UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  supplier_brand      NVARCHAR(64)     NOT NULL,
  style_description   NVARCHAR(MAX)    NULL,
  fabric_description  NVARCHAR(255)    NULL,
  extra_notes         NVARCHAR(MAX)    NULL,
  source_file         NVARCHAR(255)    NULL,
  source_row          INT              NULL,
  is_deleted          BIT              NOT NULL DEFAULT 0,
  created_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('style_note_compositions', 'U') IS NULL
CREATE TABLE style_note_compositions (
  style_note_id  UNIQUEIDENTIFIER NOT NULL REFERENCES style_notes(id) ON DELETE CASCADE,
  fiber_code     NVARCHAR(32)     NOT NULL,
  percentage     DECIMAL(5,2)     NOT NULL,
  PRIMARY KEY (style_note_id, fiber_code)
);
GO

-- ---------- 19. fabric_similarities ----------
IF OBJECT_ID('fabric_similarities', 'U') IS NULL
CREATE TABLE fabric_similarities (
  fabric_id          NVARCHAR(32) NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
  similar_fabric_id  NVARCHAR(32) NOT NULL REFERENCES fabrics(id),
  score              DECIMAL(5,2) NOT NULL,
  reason             NVARCHAR(255) NULL,
  PRIMARY KEY (fabric_id, similar_fabric_id)
);
GO

-- ---------- 20. audit_logs ----------
IF OBJECT_ID('audit_logs', 'U') IS NULL
CREATE TABLE audit_logs (
  id            BIGINT IDENTITY PRIMARY KEY,
  user_id       UNIQUEIDENTIFIER NULL,
  username      NVARCHAR(64)     NULL,
  action        NVARCHAR(32)     NOT NULL,
  entity_type   NVARCHAR(32)     NOT NULL,
  entity_id     NVARCHAR(64)     NULL,
  before_value  NVARCHAR(MAX)    NULL,
  after_value   NVARCHAR(MAX)    NULL,
  ip            NVARCHAR(45)     NULL,
  user_agent    NVARCHAR(255)    NULL,
  created_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX ix_audit_user   ON audit_logs(user_id, created_at DESC);
GO

-- ---------- 21. import_batches ----------
IF OBJECT_ID('import_batches', 'U') IS NULL
CREATE TABLE import_batches (
  id             UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  filename       NVARCHAR(255)    NOT NULL,
  file_hash      CHAR(64)         NULL,
  total_rows     INT              NOT NULL,
  success_count  INT              NOT NULL,
  failed_count   INT              NOT NULL,
  error_report   NVARCHAR(MAX)    NULL,
  user_id        UNIQUEIDENTIFIER NULL,
  created_at     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  finished_at    DATETIME2        NULL
);
GO

-- ---------- 22. schema_migrations ----------
IF OBJECT_ID('schema_migrations', 'U') IS NULL
CREATE TABLE schema_migrations (
  filename    NVARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
