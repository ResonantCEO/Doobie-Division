--
-- PostgreSQL database dump
--

\restrict nk9PwyRvklNXRJ1LjIlOiCOlivM2FjIBeziWNqusxMsiw2uJ5bNEHlONd8MC4i5

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: access_passwords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_passwords (
    id integer NOT NULL,
    label character varying NOT NULL,
    password character varying NOT NULL,
    valid_from timestamp without time zone,
    valid_to timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: access_passwords_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.access_passwords_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_passwords_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.access_passwords_id_seq OWNED BY public.access_passwords.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    parent_id integer,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: city_purchase_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.city_purchase_limits (
    id integer NOT NULL,
    city_name character varying NOT NULL,
    minimum_amount numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    delivery_blocked boolean DEFAULT false NOT NULL
);


--
-- Name: city_purchase_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.city_purchase_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: city_purchase_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.city_purchase_limits_id_seq OWNED BY public.city_purchase_limits.id;


--
-- Name: discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discounts (
    id integer NOT NULL,
    name character varying NOT NULL,
    description text,
    type character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    min_quantity integer,
    min_spend numeric(10,2),
    required_product_ids text,
    discount_percent numeric(5,2),
    free_product_id integer,
    free_product_quantity integer DEFAULT 1,
    apply_to_product_id integer,
    apply_to_category_id integer,
    valid_from timestamp without time zone,
    valid_to timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: discounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discounts_id_seq OWNED BY public.discounts.id;


--
-- Name: inventory_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_logs (
    id integer NOT NULL,
    product_id integer,
    type character varying NOT NULL,
    quantity integer NOT NULL,
    previous_stock integer NOT NULL,
    new_stock integer NOT NULL,
    reason text,
    user_id character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: inventory_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_logs_id_seq OWNED BY public.inventory_logs.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id character varying,
    type character varying NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    data jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer,
    product_id integer,
    product_name character varying NOT NULL,
    product_price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    fulfilled boolean DEFAULT false,
    product_sku character varying
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number character varying NOT NULL,
    customer_id character varying,
    customer_name character varying NOT NULL,
    customer_email character varying NOT NULL,
    customer_phone character varying NOT NULL,
    shipping_address text NOT NULL,
    total numeric(10,2) NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    payment_method character varying DEFAULT 'cod'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    assigned_user_id character varying,
    payment_photo_url text
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    token character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: price_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_templates (
    id integer NOT NULL,
    name character varying NOT NULL,
    description text,
    template_type character varying DEFAULT 'units'::character varying NOT NULL,
    price numeric(10,2),
    price_per_gram numeric(10,4),
    price_per_ounce numeric(10,2),
    price_per_eighth numeric(10,2),
    price_per_quarter numeric(10,2),
    price_per_half numeric(10,2),
    quantity_tiers text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: price_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.price_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: price_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.price_templates_id_seq OWNED BY public.price_templates.id;


--
-- Name: product_quantity_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_quantity_pricing (
    id integer NOT NULL,
    product_id integer NOT NULL,
    min_quantity integer NOT NULL,
    price_per_item numeric(10,4) NOT NULL
);


--
-- Name: product_quantity_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_quantity_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_quantity_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_quantity_pricing_id_seq OWNED BY public.product_quantity_pricing.id;


--
-- Name: product_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_sizes (
    id integer NOT NULL,
    product_id integer NOT NULL,
    size character varying NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    physical_quantity integer DEFAULT 0 NOT NULL
);


--
-- Name: product_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_sizes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_sizes_id_seq OWNED BY public.product_sizes.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying NOT NULL,
    description text,
    price numeric(10,2),
    sku character varying NOT NULL,
    category_id integer,
    image_url text,
    stock integer DEFAULT 0 NOT NULL,
    min_stock_threshold integer DEFAULT 5 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    selling_method character varying DEFAULT 'units'::character varying NOT NULL,
    weight_unit character varying DEFAULT 'grams'::character varying,
    price_per_gram numeric(10,4),
    price_per_ounce numeric(10,2),
    discount_percentage numeric(5,2) DEFAULT '0'::numeric,
    physical_inventory integer DEFAULT 0 NOT NULL,
    company character varying,
    purchase_price numeric(10,2),
    admin_notes text,
    purchase_price_method character varying DEFAULT 'units'::character varying,
    purchase_price_per_gram numeric(10,4),
    purchase_price_per_ounce numeric(10,2),
    image_urls text,
    price_per_eighth numeric(10,2),
    price_per_quarter numeric(10,2),
    price_per_half numeric(10,2)
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: promo_code_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_uses (
    id integer NOT NULL,
    promo_code_id integer NOT NULL,
    user_id character varying NOT NULL,
    used_at timestamp without time zone DEFAULT now()
);


--
-- Name: promo_code_uses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_code_uses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_code_uses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_code_uses_id_seq OWNED BY public.promo_code_uses.id;


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id integer NOT NULL,
    code character varying NOT NULL,
    description text,
    discount_type character varying DEFAULT 'percent'::character varying NOT NULL,
    discount_value text DEFAULT '0'::text NOT NULL,
    bypass_purchase_minimum boolean DEFAULT false NOT NULL,
    usage_limit_type character varying DEFAULT 'unlimited'::character varying NOT NULL,
    max_total_uses integer,
    total_uses integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from timestamp without time zone,
    valid_to timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    min_order_amount text
);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_codes_id_seq OWNED BY public.promo_codes.id;


--
-- Name: promotional_ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotional_ads (
    id integer NOT NULL,
    title character varying NOT NULL,
    subtitle text,
    button_text character varying DEFAULT 'Shop Now'::character varying,
    button_link character varying,
    background_image_url text,
    background_color character varying DEFAULT '#1a1a2e'::character varying,
    text_color character varying DEFAULT 'white'::character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    valid_from timestamp without time zone,
    valid_to timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    discount_id integer
);


--
-- Name: promotional_ads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotional_ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotional_ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotional_ads_id_seq OWNED BY public.promotional_ads.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: support_ticket_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_responses (
    id integer NOT NULL,
    ticket_id integer,
    message text NOT NULL,
    type character varying NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: support_ticket_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_ticket_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_ticket_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_ticket_responses_id_seq OWNED BY public.support_ticket_responses.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    user_id character varying,
    customer_name character varying,
    customer_email character varying,
    customer_phone character varying,
    subject character varying NOT NULL,
    message text NOT NULL,
    priority character varying DEFAULT 'normal'::character varying NOT NULL,
    status character varying DEFAULT 'open'::character varying NOT NULL,
    assigned_to character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    archived boolean DEFAULT false NOT NULL,
    customer_telegram character varying
);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_logs (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    action character varying NOT NULL,
    details text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_activity_logs_id_seq OWNED BY public.user_activity_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    role character varying DEFAULT 'customer'::character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    password character varying,
    id_image_url character varying,
    id_verification_status character varying DEFAULT 'pending'::character varying NOT NULL,
    verification_photo_url character varying,
    address text,
    city character varying,
    state character varying,
    postal_code character varying,
    country character varying DEFAULT 'Canada'::character varying,
    min_purchase_exempt boolean DEFAULT false NOT NULL,
    min_purchase_override numeric(10,2),
    telegram_username character varying,
    granted_access_password_id integer,
    phone_number character varying,
    referral_code character varying,
    referred_by character varying,
    referral_count integer DEFAULT 0 NOT NULL
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: access_passwords id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_passwords ALTER COLUMN id SET DEFAULT nextval('public.access_passwords_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: city_purchase_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_purchase_limits ALTER COLUMN id SET DEFAULT nextval('public.city_purchase_limits_id_seq'::regclass);


--
-- Name: discounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts ALTER COLUMN id SET DEFAULT nextval('public.discounts_id_seq'::regclass);


--
-- Name: inventory_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs ALTER COLUMN id SET DEFAULT nextval('public.inventory_logs_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: price_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_templates ALTER COLUMN id SET DEFAULT nextval('public.price_templates_id_seq'::regclass);


--
-- Name: product_quantity_pricing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_quantity_pricing ALTER COLUMN id SET DEFAULT nextval('public.product_quantity_pricing_id_seq'::regclass);


--
-- Name: product_sizes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes ALTER COLUMN id SET DEFAULT nextval('public.product_sizes_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promo_code_uses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses ALTER COLUMN id SET DEFAULT nextval('public.promo_code_uses_id_seq'::regclass);


--
-- Name: promo_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes ALTER COLUMN id SET DEFAULT nextval('public.promo_codes_id_seq'::regclass);


--
-- Name: promotional_ads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotional_ads ALTER COLUMN id SET DEFAULT nextval('public.promotional_ads_id_seq'::regclass);


--
-- Name: support_ticket_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_responses ALTER COLUMN id SET DEFAULT nextval('public.support_ticket_responses_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: user_activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.user_activity_logs_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: access_passwords; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.access_passwords (id, label, password, valid_from, valid_to, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, description, created_at, parent_id, is_active, sort_order) FROM stdin;
2	Indica		2025-07-24 01:30:13.992508	1	t	0
7	Womens		2025-07-25 01:17:21.218082	3	t	0
8	Mens		2025-07-25 01:17:30.987185	3	t	0
9	Pants		2025-07-25 01:17:39.478206	8	t	0
10	Pants		2025-07-25 01:17:47.229156	7	t	0
11	Shirts		2025-07-25 01:17:56.723465	8	t	0
12	Shirts		2025-07-25 01:18:11.649813	7	t	0
13	Sativa		2025-07-25 01:18:25.007664	1	t	0
3	Clothing		2025-07-25 01:15:47.649647	14	t	0
17	Pre-Rolls		2025-07-29 20:35:56.699242	2	t	0
18	Pre-Rolls 		2025-07-29 20:36:11.495865	13	t	0
21	Wax		2025-07-29 20:38:02.181533	15	t	0
22	Oil		2025-07-29 20:38:12.766178	15	t	0
23	Shatter		2025-07-29 20:38:21.254589	15	t	0
24	Live Resin		2025-07-29 20:38:33.119662	15	t	0
25	Hash		2025-07-29 20:38:59.935846	15	t	0
26	Cartridges		2025-07-29 20:39:26.292688	15	t	0
27	Candy		2025-07-29 20:39:46.864313	16	t	0
28	Brownies		2025-07-29 20:39:58.902887	16	t	0
29	Fudge		2025-07-29 20:40:08.452854	16	t	0
31	Bud		2025-07-30 22:41:02.015999	2	t	0
32	Bud		2025-07-30 22:41:20.970263	13	t	0
33	Accessories		2025-08-12 21:31:05.16032	14	t	0
20	Tinctures		2025-07-29 20:36:44.644438	\N	t	4
19	Topicals		2025-07-29 20:36:30.298552	\N	t	5
16	Edibles		2025-07-29 20:34:13.893122	\N	t	3
1	Flower		2025-07-24 01:29:50.265459	\N	t	1
15	Concentrates		2025-07-29 20:33:59.375214	\N	t	0
14	Merch		2025-07-25 01:19:12.985551	\N	t	2
\.


--
-- Data for Name: city_purchase_limits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.city_purchase_limits (id, city_name, minimum_amount, is_active, created_at, updated_at, delivery_blocked) FROM stdin;
4	Williamsburg	50.00	t	2026-02-23 03:53:35.557473	2026-02-25 02:16:43.808	f
\.


--
-- Data for Name: discounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.discounts (id, name, description, type, is_active, min_quantity, min_spend, required_product_ids, discount_percent, free_product_id, free_product_quantity, apply_to_product_id, apply_to_category_id, valid_from, valid_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_logs (id, product_id, type, quantity, previous_stock, new_stock, reason, user_id, created_at) FROM stdin;
297	72	physical_out	-14	250	236	Order fulfillment - Order #66 (Physical inventory reduced)	80ee892a-03d7-46ba-ad90-c69434e16c4a	2026-03-04 03:36:01.116
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, message, data, is_read, created_at) FROM stdin;
56	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #082525-1 from Josh Osgood ($10)	{"total": "10", "orderId": 35, "orderNumber": "082525-1"}	f	2025-08-25 17:42:14.238829
57	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #082525-1 from Josh Osgood ($10)	{"total": "10", "orderId": 35, "orderNumber": "082525-1"}	f	2025-08-25 17:42:14.300499
69	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #012426-1 from Josh Osgood ($10)	{"total": "10", "orderId": 36, "orderNumber": "012426-1"}	f	2026-01-24 15:49:55.677899
70	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #012426-1 from Josh Osgood ($10)	{"total": "10", "orderId": 36, "orderNumber": "012426-1"}	f	2026-01-24 15:49:55.742176
76	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #012426-2 from Josh Osgood ($10)	{"total": "10", "orderId": 37, "orderNumber": "012426-2"}	f	2026-01-24 16:25:53.882144
77	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #012426-2 from Josh Osgood ($10)	{"total": "10", "orderId": 37, "orderNumber": "012426-2"}	f	2026-01-24 16:25:53.942051
79	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #012426-3 from Josh Osgood  ($10)	{"total": "10", "orderId": 38, "orderNumber": "012426-3"}	f	2026-01-24 16:27:20.51354
80	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #012426-3 from Josh Osgood  ($10)	{"total": "10", "orderId": 38, "orderNumber": "012426-3"}	f	2026-01-24 16:27:20.573513
82	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #012426-4 from Josh Osgood ($1380)	{"total": "1380", "orderId": 39, "orderNumber": "012426-4"}	f	2026-01-24 16:31:19.832332
83	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #012426-4 from Josh Osgood ($1380)	{"total": "1380", "orderId": 39, "orderNumber": "012426-4"}	f	2026-01-24 16:31:19.891931
88	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #012426-5 from Josh Osgood ($10)	{"total": "10", "orderId": 40, "orderNumber": "012426-5"}	f	2026-01-24 17:41:49.94728
89	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #012426-5 from Josh Osgood ($10)	{"total": "10", "orderId": 40, "orderNumber": "012426-5"}	f	2026-01-24 17:41:50.007777
92	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021626-1 from Josh Osgood ($10)	{"total": "10", "orderId": 41, "orderNumber": "021626-1"}	f	2026-02-16 15:14:27.344966
93	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021626-1 from Josh Osgood ($10)	{"total": "10", "orderId": 41, "orderNumber": "021626-1"}	f	2026-02-16 15:14:27.404804
116	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_support_ticket	New Support Ticket	New support ticket from allen: General Inquiry	{"subject": "General Inquiry", "priority": "normal", "ticketId": 10, "customerName": "allen"}	f	2026-02-16 15:40:03.670662
97	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021626-1 from Josh Osgood ($10)	{"total": "10", "orderId": 42, "orderNumber": "021626-1"}	f	2026-02-16 15:15:48.188414
98	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021626-1 from Josh Osgood ($10)	{"total": "10", "orderId": 42, "orderNumber": "021626-1"}	f	2026-02-16 15:15:48.24756
100	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021626-2 from Josh Osgood ($10)	{"total": "10", "orderId": 43, "orderNumber": "021626-2"}	f	2026-02-16 15:21:18.85908
101	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021626-2 from Josh Osgood ($10)	{"total": "10", "orderId": 43, "orderNumber": "021626-2"}	f	2026-02-16 15:21:18.921112
103	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021626-3 from Josh Osgood ($12)	{"total": "12", "orderId": 44, "orderNumber": "021626-3"}	f	2026-02-16 15:21:29.307091
104	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021626-3 from Josh Osgood ($12)	{"total": "12", "orderId": 44, "orderNumber": "021626-3"}	f	2026-02-16 15:21:29.367968
106	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021626-4 from Josh Osgood ($15)	{"total": "15", "orderId": 45, "orderNumber": "021626-4"}	f	2026-02-16 15:21:40.442035
107	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021626-4 from Josh Osgood ($15)	{"total": "15", "orderId": 45, "orderNumber": "021626-4"}	f	2026-02-16 15:21:40.536487
109	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021626-5 from Josh Osgood ($10)	{"total": "10", "orderId": 46, "orderNumber": "021626-5"}	f	2026-02-16 15:21:53.244927
110	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021626-5 from Josh Osgood ($10)	{"total": "10", "orderId": 46, "orderNumber": "021626-5"}	f	2026-02-16 15:21:53.303656
118	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021726-1 from Josh Osgood ($25)	{"total": "25", "orderId": 47, "orderNumber": "021726-1"}	f	2026-02-17 21:20:43.806385
119	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021726-1 from Josh Osgood ($25)	{"total": "25", "orderId": 47, "orderNumber": "021726-1"}	f	2026-02-17 21:20:43.866724
157	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #030326-771 from Josh Osgood ($28)	{"total": "28", "orderId": 61, "orderNumber": "030326-771"}	f	2026-03-03 18:20:45.141928
150	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #022526-113 from Test Test ($57.5)	{"total": "57.5", "orderId": 59, "orderNumber": "022526-113"}	f	2026-02-25 00:44:09.983418
151	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #022526-113 from Test Test ($57.5)	{"total": "57.5", "orderId": 59, "orderNumber": "022526-113"}	f	2026-02-25 00:44:09.986963
121	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-695 from Test Customer ($25)	{"total": "25", "orderId": 50, "orderNumber": "021826-695"}	f	2026-02-18 20:29:17.710311
122	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-695 from Test Customer ($25)	{"total": "25", "orderId": 50, "orderNumber": "021826-695"}	f	2026-02-18 20:29:17.714098
139	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-123 from Josh Osgood ($25)	{"total": "25", "orderId": 56, "orderNumber": "021826-123"}	f	2026-02-18 21:27:24.830298
124	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-893 from Josh Osgood ($25)	{"total": "25", "orderId": 51, "orderNumber": "021826-893"}	f	2026-02-18 20:30:36.683845
125	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-893 from Josh Osgood ($25)	{"total": "25", "orderId": 51, "orderNumber": "021826-893"}	f	2026-02-18 20:30:36.688959
140	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-123 from Josh Osgood ($25)	{"total": "25", "orderId": 56, "orderNumber": "021826-123"}	f	2026-02-18 21:27:24.83482
127	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-894 from Josh Osgood ($24)	{"total": "24", "orderId": 52, "orderNumber": "021826-894"}	f	2026-02-18 20:31:47.766422
128	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-894 from Josh Osgood ($24)	{"total": "24", "orderId": 52, "orderNumber": "021826-894"}	f	2026-02-18 20:31:47.770676
147	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #022326-562 from Josh Osgood ($10)	{"total": "10", "orderId": 58, "orderNumber": "022326-562"}	f	2026-02-23 04:59:46.062513
154	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #030326-959 from Josh Osgood ($28)	{"total": "28", "orderId": 60, "orderNumber": "030326-959"}	f	2026-03-03 18:00:32.937605
148	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #022326-562 from Josh Osgood ($10)	{"total": "10", "orderId": 58, "orderNumber": "022326-562"}	f	2026-02-23 04:59:46.069052
155	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #030326-959 from Josh Osgood ($28)	{"total": "28", "orderId": 60, "orderNumber": "030326-959"}	f	2026-03-03 18:00:32.941036
158	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #030326-771 from Josh Osgood ($28)	{"total": "28", "orderId": 61, "orderNumber": "030326-771"}	f	2026-03-03 18:20:45.146342
130	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-695 from Josh Osgood ($25)	{"total": "25", "orderId": 53, "orderNumber": "021826-695"}	f	2026-02-18 20:43:17.338957
131	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-695 from Josh Osgood ($25)	{"total": "25", "orderId": 53, "orderNumber": "021826-695"}	f	2026-02-18 20:43:17.343438
143	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-124 from Josh Osgood ($200)	{"total": "200", "orderId": 57, "orderNumber": "021826-124"}	f	2026-02-18 21:32:22.776164
133	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-813 from Josh Osgood ($25)	{"total": "25", "orderId": 54, "orderNumber": "021826-813"}	f	2026-02-18 21:00:14.295738
134	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-813 from Josh Osgood ($25)	{"total": "25", "orderId": 54, "orderNumber": "021826-813"}	f	2026-02-18 21:00:14.29964
136	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #021826-122 from Josh Osgood ($25)	{"total": "25", "orderId": 55, "orderNumber": "021826-122"}	f	2026-02-18 21:13:32.969296
137	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-122 from Josh Osgood ($25)	{"total": "25", "orderId": 55, "orderNumber": "021826-122"}	f	2026-02-18 21:13:32.973829
144	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #021826-124 from Josh Osgood ($200)	{"total": "200", "orderId": 57, "orderNumber": "021826-124"}	f	2026-02-18 21:32:22.780531
159	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #030326-772 from Josh Osgood ($28)	{"total": "28", "orderId": 62, "orderNumber": "030326-772"}	t	2026-03-03 18:29:51.42127
152	fa3d9a99-dc97-4b51-937b-63b07a43415d	order_status_update	Order 022526-113 Update	Your order status has been updated to packed	{"total": "57.5", "status": "packed", "orderId": 59, "orderNumber": "022526-113"}	f	2026-02-25 02:32:30.30686
156	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #030326-771 from Josh Osgood ($28)	{"total": "28", "orderId": 61, "orderNumber": "030326-771"}	t	2026-03-03 18:20:45.138375
160	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #030326-772 from Josh Osgood ($28)	{"total": "28", "orderId": 62, "orderNumber": "030326-772"}	f	2026-03-03 18:29:51.425106
161	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #030326-772 from Josh Osgood ($28)	{"total": "28", "orderId": 62, "orderNumber": "030326-772"}	f	2026-03-03 18:29:51.428307
163	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #030326-773 from Josh Osgood ($28)	{"total": "28", "orderId": 63, "orderNumber": "030326-773"}	f	2026-03-03 18:34:07.194921
164	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #030326-773 from Josh Osgood ($28)	{"total": "28", "orderId": 63, "orderNumber": "030326-773"}	f	2026-03-03 18:34:07.198729
153	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #030326-959 from Josh Osgood ($28)	{"total": "28", "orderId": 60, "orderNumber": "030326-959"}	t	2026-03-03 18:00:32.932616
166	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #030326-492 from Josh Osgood ($7)	{"total": "7", "orderId": 64, "orderNumber": "030326-492"}	f	2026-03-03 18:36:11.529251
167	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #030326-492 from Josh Osgood ($7)	{"total": "7", "orderId": 64, "orderNumber": "030326-492"}	f	2026-03-03 18:36:11.532654
181	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #031026-802 from Josh Osgood ($1)	{"total": "1", "orderId": 68, "orderNumber": "031026-802"}	f	2026-03-10 17:30:07.415147
168	80ee892a-03d7-46ba-ad90-c69434e16c4a	order_status_update	Order 030326-492 Update	Your order has been delivered	{"total": "7", "status": "delivered", "orderId": 64, "orderNumber": "030326-492"}	f	2026-03-03 18:36:28.894724
182	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #031026-802 from Josh Osgood ($1)	{"total": "1", "orderId": 68, "orderNumber": "031026-802"}	f	2026-03-10 17:30:07.420473
170	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #030426-589 from Josh Osgood ($7)	{"total": "7", "orderId": 65, "orderNumber": "030426-589"}	f	2026-03-04 03:31:35.989289
171	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #030426-589 from Josh Osgood ($7)	{"total": "7", "orderId": 65, "orderNumber": "030426-589"}	f	2026-03-04 03:31:35.993592
178	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #031026-801 from Josh Osgood ($1)	{"total": "1", "orderId": 67, "orderNumber": "031026-801"}	f	2026-03-10 17:28:53.940534
179	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #031026-801 from Josh Osgood ($1)	{"total": "1", "orderId": 67, "orderNumber": "031026-801"}	f	2026-03-10 17:28:53.94522
172	80ee892a-03d7-46ba-ad90-c69434e16c4a	order_status_update	Order 030426-589 Update	Your order has been delivered	{"total": "7", "status": "delivered", "orderId": 65, "orderNumber": "030426-589"}	f	2026-03-04 03:31:55.150242
174	6c5f8520-236e-407c-9a23-ed2e19f7fdb7	new_order	New Order Received	Order #030426-590 from Josh Osgood ($14)	{"total": "14", "orderId": 66, "orderNumber": "030426-590"}	f	2026-03-04 03:35:48.439807
175	067275e9-f75d-4bb6-a58a-b81b0c179e23	new_order	New Order Received	Order #030426-590 from Josh Osgood ($14)	{"total": "14", "orderId": 66, "orderNumber": "030426-590"}	f	2026-03-04 03:35:48.445883
180	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #031026-802 from Josh Osgood ($1)	{"total": "1", "orderId": 68, "orderNumber": "031026-802"}	t	2026-03-10 17:30:07.411824
177	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #031026-801 from Josh Osgood ($1)	{"total": "1", "orderId": 67, "orderNumber": "031026-801"}	t	2026-03-10 17:28:53.933509
173	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #030426-590 from Josh Osgood ($14)	{"total": "14", "orderId": 66, "orderNumber": "030426-590"}	t	2026-03-04 03:35:48.434497
169	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #030426-589 from Josh Osgood ($7)	{"total": "7", "orderId": 65, "orderNumber": "030426-589"}	t	2026-03-04 03:31:35.983388
165	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #030326-492 from Josh Osgood ($7)	{"total": "7", "orderId": 64, "orderNumber": "030326-492"}	t	2026-03-03 18:36:11.525955
162	80ee892a-03d7-46ba-ad90-c69434e16c4a	new_order	New Order Received	Order #030326-773 from Josh Osgood ($28)	{"total": "28", "orderId": 63, "orderNumber": "030326-773"}	t	2026-03-03 18:34:07.190024
176	80ee892a-03d7-46ba-ad90-c69434e16c4a	order_status_update	Order 030426-590 Update	Your order has been delivered	{"total": "14", "status": "delivered", "orderId": 66, "orderNumber": "030426-590"}	f	2026-03-04 03:36:24.238397
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, product_id, product_name, product_price, quantity, subtotal, fulfilled, product_sku) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, order_number, customer_id, customer_name, customer_email, customer_phone, shipping_address, total, status, payment_method, notes, created_at, updated_at, assigned_user_id, payment_photo_url) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: price_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.price_templates (id, name, description, template_type, price, price_per_gram, price_per_ounce, price_per_eighth, price_per_quarter, price_per_half, quantity_tiers, created_at, updated_at) FROM stdin;
2	Tier 1 Flower	Tier 1 	weight	\N	1.0000	5.00	2.00	3.00	4.00	\N	2026-07-08 17:49:59.73821	2026-07-08 17:49:59.73821
\.


--
-- Data for Name: product_quantity_pricing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_quantity_pricing (id, product_id, min_quantity, price_per_item) FROM stdin;
\.


--
-- Data for Name: product_sizes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_sizes (id, product_id, size, quantity, created_at, updated_at, physical_quantity) FROM stdin;
17	73	Small	15	2026-03-10 16:55:58.211	2026-03-10 16:55:58.211	15
18	73	Medium	15	2026-03-10 16:55:58.211	2026-03-10 16:55:58.211	15
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, description, price, sku, category_id, image_url, stock, min_stock_threshold, is_active, created_at, updated_at, selling_method, weight_unit, price_per_gram, price_per_ounce, discount_percentage, physical_inventory, company, purchase_price, admin_notes, purchase_price_method, purchase_price_per_gram, purchase_price_per_ounce, image_urls, price_per_eighth, price_per_quarter, price_per_half) FROM stdin;
73	test2		0.00	1234	31	/api/product-images/53f8baa1-3b01-4ce8-8478-09f1fb59f3f8.png	30	5	t	2026-03-10 16:55:58.125243	2026-03-10 16:55:57.926	weight	grams	1.0000	28.00	0.00	30	yes	\N		units	\N	\N	["/api/product-images/53f8baa1-3b01-4ce8-8478-09f1fb59f3f8.png"]	3.50	7.00	28.00
72	test		0.00	7474	31	/api/product-images/d7140471-5555-4a5e-854c-92ed77ebd74d.png	234	5	t	2026-03-04 03:35:07.592766	2026-03-10 17:30:07.401554	weight	grams	1.0000	28.00	0.00	236		23.00	notes	units	\N	\N	["/api/product-images/d7140471-5555-4a5e-854c-92ed77ebd74d.png"]	3.50	7.00	14.00
\.


--
-- Data for Name: promo_code_uses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promo_code_uses (id, promo_code_id, user_id, used_at) FROM stdin;
\.


--
-- Data for Name: promo_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promo_codes (id, code, description, discount_type, discount_value, bypass_purchase_minimum, usage_limit_type, max_total_uses, total_uses, is_active, valid_from, valid_to, created_at, min_order_amount) FROM stdin;
\.


--
-- Data for Name: promotional_ads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotional_ads (id, title, subtitle, button_text, button_link, background_image_url, background_color, text_color, is_active, sort_order, valid_from, valid_to, created_at, updated_at, discount_id) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
-V3RupZYFx5zFPSe0oqYlaMB0XMVcN56	{"cookie": {"path": "/", "secure": false, "expires": "2026-07-09T19:59:31.947Z", "httpOnly": true, "sameSite": "strict", "originalMaxAge": 604800000}, "userId": "80ee892a-03d7-46ba-ad90-c69434e16c4a"}	2026-07-16 19:26:09
\.


--
-- Data for Name: support_ticket_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_ticket_responses (id, ticket_id, message, type, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, user_id, customer_name, customer_email, customer_phone, subject, message, priority, status, assigned_to, created_at, updated_at, archived, customer_telegram) FROM stdin;
\.


--
-- Data for Name: user_activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_activity_logs (id, user_id, action, details, metadata, created_at) FROM stdin;
1	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"}	2026-02-17 19:48:32.904082
2	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/2.3.21 Chrome/138.0.7204.251 Electron/37.7.0 Safari/537.36"}	2026-02-17 19:56:50.313688
3	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "127.0.0.1"}	2026-02-17 20:26:08.455265
4	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"}	2026-02-17 20:31:35.334476
5	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "127.0.0.1"}	2026-02-17 20:37:58.742475
6	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"}	2026-02-17 20:43:32.348757
7	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "127.0.0.1"}	2026-02-17 20:48:07.289889
8	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"}	2026-02-17 20:48:19.529732
9	80ee892a-03d7-46ba-ad90-c69434e16c4a	Profile Updated	User profile updated: firstName, lastName, email, role, status, address, city, state, postalCode, minPurchaseExempt, minPurchaseOverride	{"updatedFields": {"city": "1", "role": "admin", "email": "josgood09@gmail.com", "state": "Virginia", "status": "active", "address": "1", "lastName": "Osgood", "firstName": "Josh", "postalCode": "1", "minPurchaseExempt": false, "minPurchaseOverride": "250"}}	2026-02-23 04:44:16.938214
10	80ee892a-03d7-46ba-ad90-c69434e16c4a	Profile Updated	User profile updated: firstName, lastName, email, role, status, address, city, state, postalCode, minPurchaseExempt, minPurchaseOverride	{"updatedFields": {"city": "1", "role": "admin", "email": "josgood09@gmail.com", "state": "Virginia", "status": "active", "address": "1", "lastName": "Osgood", "firstName": "Josh", "postalCode": "1", "minPurchaseExempt": true, "minPurchaseOverride": "250"}}	2026-02-23 04:49:59.208837
11	80ee892a-03d7-46ba-ad90-c69434e16c4a	Profile Updated	User profile updated: firstName, lastName, email, role, status, address, city, state, postalCode, minPurchaseExempt, minPurchaseOverride	{"updatedFields": {"city": "1", "role": "admin", "email": "josgood09@gmail.com", "state": "Virginia", "status": "active", "address": "1", "lastName": "Osgood", "firstName": "Josh", "postalCode": "1", "minPurchaseExempt": true, "minPurchaseOverride": "250"}}	2026-02-23 04:50:58.721014
12	fa3d9a99-dc97-4b51-937b-63b07a43415d	Login	User logged in successfully	{"ipAddress": "10.82.10.91", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 00:39:15.919355
13	fa3d9a99-dc97-4b51-937b-63b07a43415d	Logout	User logged out successfully	{"ipAddress": "10.82.10.91"}	2026-02-25 00:48:27.871894
14	fa3d9a99-dc97-4b51-937b-63b07a43415d	Login	User logged in successfully	{"ipAddress": "10.82.12.38", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 00:50:00.364126
15	fa3d9a99-dc97-4b51-937b-63b07a43415d	Logout	User logged out successfully	{"ipAddress": "10.82.9.35"}	2026-02-25 00:50:12.860493
16	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "10.82.9.35", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 00:50:23.626771
17	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "10.82.4.67"}	2026-02-25 00:51:55.004784
18	fa3d9a99-dc97-4b51-937b-63b07a43415d	Login	User logged in successfully	{"ipAddress": "10.82.4.67", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 00:59:13.297978
19	fa3d9a99-dc97-4b51-937b-63b07a43415d	Logout	User logged out successfully	{"ipAddress": "10.82.4.67"}	2026-02-25 00:59:24.8705
20	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "10.82.4.67", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 00:59:36.416932
21	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "10.82.6.129"}	2026-02-25 01:06:30.965021
22	fa3d9a99-dc97-4b51-937b-63b07a43415d	Login	User logged in successfully	{"ipAddress": "10.82.3.34", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 01:06:44.280507
23	fa3d9a99-dc97-4b51-937b-63b07a43415d	Logout	User logged out successfully	{"ipAddress": "10.82.6.129"}	2026-02-25 01:07:19.332828
24	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "10.82.6.129", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 01:07:30.51415
25	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "10.82.3.34"}	2026-02-25 01:11:03.336168
26	fa3d9a99-dc97-4b51-937b-63b07a43415d	Login	User logged in successfully	{"ipAddress": "10.82.3.34", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 01:11:16.687287
27	fa3d9a99-dc97-4b51-937b-63b07a43415d	Logout	User logged out successfully	{"ipAddress": "10.82.10.91"}	2026-02-25 01:14:16.678776
28	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "10.82.6.129", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 01:14:29.100204
29	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "10.82.9.35"}	2026-02-25 02:11:55.382436
30	fa3d9a99-dc97-4b51-937b-63b07a43415d	Login	User logged in successfully	{"ipAddress": "10.82.10.91", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 02:12:14.066169
31	fa3d9a99-dc97-4b51-937b-63b07a43415d	Logout	User logged out successfully	{"ipAddress": "10.82.10.91"}	2026-02-25 02:12:34.336991
32	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "10.82.12.38", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-02-25 02:13:03.660525
33	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "10.82.7.19", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.0.14 Chrome/124.0.6367.119 Electron/30.0.3 Safari/537.36"}	2026-03-04 03:19:48.341416
34	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.1.5 Chrome/142.0.7444.265 Electron/39.8.9 Safari/537.36"}	2026-06-27 19:03:52.835766
35	80ee892a-03d7-46ba-ad90-c69434e16c4a	Logout	User logged out successfully	{"ipAddress": "127.0.0.1"}	2026-06-27 19:11:14.816347
36	80ee892a-03d7-46ba-ad90-c69434e16c4a	Login	User logged in successfully	{"ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Replit/1.1.5 Chrome/142.0.7444.265 Electron/39.8.9 Safari/537.36"}	2026-07-02 19:59:32.232284
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, first_name, last_name, profile_image_url, role, status, created_at, updated_at, password, id_image_url, id_verification_status, verification_photo_url, address, city, state, postal_code, country, min_purchase_exempt, min_purchase_override, telegram_username, granted_access_password_id, phone_number, referral_code, referred_by, referral_count) FROM stdin;
d7b89870-ecd8-4f89-9558-c0d114ac06bf	tomjones@gmail.com	Tom	Jones	\N	customer	active	2025-08-25 17:38:43.539675	2025-10-24 23:54:57.1	$2b$12$bzYRGj6k5HRgkFOsOs1QYeAURIS3fit84Xarm0mQMN/WzkasYQgV2	/uploads/id-images/1756143520935-5b72dea7785cd7ffd52d1f33758be5279b203c86e8d9f8f6e0e0ae837659942b.png	verified	/uploads/verification-photos/1756143520936-e327f0a3e2efbf346f23359767cdad78a95480a854413eea4091b67bc70802a6.png	1 Address	town	Virginia	00000	USA	f	\N	\N	\N	\N	8A3LVX9F	\N	0
fa3d9a99-dc97-4b51-937b-63b07a43415d	test@gmail.com	Test	Test	\N	customer	active	2025-08-17 14:03:35.136325	2026-02-16 15:24:04.695	$2b$12$nRbc4ER0iArtOrcJPPomp.EIWzoCnE6pcjRPIWFvhonm6jeRZVP3u	/uploads/id-images/0215a4a07bc641fade52a987ece543ff	verified	/uploads/verification-photos/9cd8f0d1620dd94c511fc882978db4e8	2	2	Virginia	2	USA	f	\N	\N	\N	\N	B7BZVZWW	\N	0
57bf6a39-0196-4d83-8ef0-3e2f503f1e84	test6@gmail.com	Test6	Test6	\N	customer	suspended	2025-08-20 02:38:12.796721	2025-08-22 15:17:43.091	$2b$12$7U3KPZ3Nqy/S6FyIiX6GAeQc.FvS4iqKi.zM1ytfQGAgqzYIV2Tw.	/uploads/id-images/41ee2ff378aa14c55e0dd561af89381e	pending	/uploads/verification-photos/4d2055feee32b2e2a647d8641b751d50	6	6	Virginia	6	USA	f	\N	\N	\N	\N	C3QL8YT5	\N	0
80ee892a-03d7-46ba-ad90-c69434e16c4a	josgood09@gmail.com	Josh	Osgood	\N	admin	active	2025-08-17 14:02:53.873305	2026-02-23 04:50:58.703	$2b$12$jkMPX17v551sFtEr7zMKBu2CFgYVJlyqBt9fR2hLrj2QckWXHaYRC	/uploads/id-images/1aac2056f8b468c5941bde128324a3f9	verified	/uploads/verification-photos/783d967d306def0717ddc1df08baf253	1	1	Virginia	1	USA	t	250.00	\N	\N	\N	P9W3WHJD	\N	0
6c5f8520-236e-407c-9a23-ed2e19f7fdb7	test2@gmail.com	Test2	Test2	\N	staff	active	2025-08-17 14:03:57.480139	2025-08-17 14:06:32.609	$2b$12$UVlhKRq91mrIescVXFVqAuTajwmCocNWrB0lt4i2wigegCufk0EZG	/uploads/id-images/43f5f366d924ef713db46dbac44ad34f	verified	/uploads/verification-photos/a0f5ed78c55dfdd721e872323be77e90	3	3	Virginia	3	USA	f	\N	\N	\N	\N	M9WK4Y23	\N	0
067275e9-f75d-4bb6-a58a-b81b0c179e23	test3@gmail.com	Test3	Test3	\N	manager	active	2025-08-17 14:04:23.908385	2025-08-17 14:06:34.343	$2b$12$IE/JWfQocijGrWAep65.XeqypBNbY7KasKCAmbx3Bf/47jY9Yof4G	/uploads/id-images/9dd98c63c8eb483866f511c295982eb4	verified	/uploads/verification-photos/990b6c936f67d6b67bf7bcfa4d692d17	4	4	Virginia	4	USA	f	\N	\N	\N	\N	26S3UAQK	\N	0
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: access_passwords_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.access_passwords_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 33, true);


--
-- Name: city_purchase_limits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.city_purchase_limits_id_seq', 4, true);


--
-- Name: discounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.discounts_id_seq', 1, false);


--
-- Name: inventory_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_logs_id_seq', 297, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 182, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 67, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 68, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- Name: price_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.price_templates_id_seq', 2, true);


--
-- Name: product_quantity_pricing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_quantity_pricing_id_seq', 2, true);


--
-- Name: product_sizes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_sizes_id_seq', 18, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_id_seq', 73, true);


--
-- Name: promo_code_uses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promo_code_uses_id_seq', 1, false);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promo_codes_id_seq', 2, true);


--
-- Name: promotional_ads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promotional_ads_id_seq', 1, false);


--
-- Name: support_ticket_responses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_ticket_responses_id_seq', 4, true);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 15, true);


--
-- Name: user_activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_activity_logs_id_seq', 36, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: access_passwords access_passwords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_passwords
    ADD CONSTRAINT access_passwords_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: city_purchase_limits city_purchase_limits_city_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_purchase_limits
    ADD CONSTRAINT city_purchase_limits_city_name_unique UNIQUE (city_name);


--
-- Name: city_purchase_limits city_purchase_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_purchase_limits
    ADD CONSTRAINT city_purchase_limits_pkey PRIMARY KEY (id);


--
-- Name: discounts discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_pkey PRIMARY KEY (id);


--
-- Name: inventory_logs inventory_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_unique UNIQUE (token);


--
-- Name: price_templates price_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_templates
    ADD CONSTRAINT price_templates_pkey PRIMARY KEY (id);


--
-- Name: product_quantity_pricing product_quantity_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_quantity_pricing
    ADD CONSTRAINT product_quantity_pricing_pkey PRIMARY KEY (id);


--
-- Name: product_sizes product_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_unique UNIQUE (sku);


--
-- Name: promo_code_uses promo_code_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_unique UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: promotional_ads promotional_ads_discount_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotional_ads
    ADD CONSTRAINT promotional_ads_discount_id_unique UNIQUE (discount_id);


--
-- Name: promotional_ads promotional_ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotional_ads
    ADD CONSTRAINT promotional_ads_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: support_ticket_responses support_ticket_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_responses
    ADD CONSTRAINT support_ticket_responses_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: IDX_categories_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_categories_is_active" ON public.categories USING btree (is_active);


--
-- Name: IDX_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_categories_parent_id" ON public.categories USING btree (parent_id);


--
-- Name: IDX_product_sizes_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_product_sizes_product_id" ON public.product_sizes USING btree (product_id);


--
-- Name: IDX_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_products_category_id" ON public.products USING btree (category_id);


--
-- Name: IDX_products_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_products_created_at" ON public.products USING btree (created_at);


--
-- Name: IDX_products_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_products_is_active" ON public.products USING btree (is_active);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: idx_pqp_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pqp_product_id ON public.product_quantity_pricing USING btree (product_id);


--
-- Name: inventory_logs inventory_logs_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_logs inventory_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_assigned_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_user_id_users_id_fk FOREIGN KEY (assigned_user_id) REFERENCES public.users(id);


--
-- Name: orders orders_customer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: product_quantity_pricing product_quantity_pricing_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_quantity_pricing
    ADD CONSTRAINT product_quantity_pricing_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_sizes product_sizes_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: promo_code_uses promo_code_uses_promo_code_id_promo_codes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_promo_code_id_promo_codes_id_fk FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE;


--
-- Name: support_ticket_responses support_ticket_responses_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_responses
    ADD CONSTRAINT support_ticket_responses_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: support_ticket_responses support_ticket_responses_ticket_id_support_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_responses
    ADD CONSTRAINT support_ticket_responses_ticket_id_support_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id);


--
-- Name: support_tickets support_tickets_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: support_tickets support_tickets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_activity_logs user_activity_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict nk9PwyRvklNXRJ1LjIlOiCOlivM2FjIBeziWNqusxMsiw2uJ5bNEHlONd8MC4i5

