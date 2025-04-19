--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4 (Debian 17.4-1.pgdg120+2)
-- Dumped by pg_dump version 17.4 (Debian 17.4-1.pgdg120+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bump_leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bump_leaderboard (
    guild_id bytea NOT NULL,
    user_id bytea NOT NULL,
    bump_count bytea NOT NULL
);


--
-- Name: cronjobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cronjobs (
    id bytea NOT NULL,
    color_time bytea NOT NULL,
    unregistered_people_time bytea
);


--
-- Name: guilds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guilds (
    case_id bytea,
    mod_log_channel_id bytea,
    color_id_of_the_day bytea,
    color_name_of_the_day bytea,
    days_to_kick bytea,
    register_channel_id bytea,
    member_role_id bytea,
    mute_role_id bytea,
    mute_get_all_roles bytea,
    join_channel_id bytea,
    register_join_channel_id bytea,
    join_message bytea,
    register_join_message bytea,
    leave_channel_id bytea,
    leave_message bytea,
    staff_role_id bytea,
    male_role_id bytea,
    female_role_id bytea,
    register_channel_clear bytea,
    mod_mail_channel_id bytea,
    dj_role_id bytea,
    mod_mail_message bytea,
    default_expiry bytea,
    mod_mail_parent_channel_id bytea,
    language bytea,
    id bytea NOT NULL,
    bump_leaderboard_channel_id bytea,
    last_bump_winner bytea,
    last_bump_winner_count bytea,
    last_bump_winner_total_count bytea
);


--
-- Name: infractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infractions (
    user_id bytea,
    moderator_id bytea,
    reason bytea,
    created_at bytea,
    expires_at bytea,
    case_id bytea,
    type bytea,
    guild_id bytea
);


--
-- Name: mod_mail_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mod_mail_messages (
    thread_id bytea,
    author_id bytea NOT NULL,
    author_type bytea NOT NULL,
    content bytea NOT NULL,
    attachments bytea,
    sent_at bytea,
    sent_to bytea NOT NULL,
    message_id bytea,
    channel_id bytea NOT NULL
);


--
-- Name: mod_mail_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mod_mail_threads (
    thread_id bytea NOT NULL,
    guild_id bytea NOT NULL,
    user_id bytea NOT NULL,
    channel_id bytea,
    status bytea NOT NULL,
    created_at bytea,
    closed_at bytea,
    close_date bytea
);


--
-- Name: mod_mail_threads_thread_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mod_mail_threads_thread_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mod_mail_threads_thread_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mod_mail_threads_thread_id_seq OWNED BY public.mod_mail_threads.thread_id;


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: punishments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.punishments (
    expires bytea NOT NULL,
    type bytea NOT NULL,
    user_id bytea NOT NULL,
    guild_id bytea NOT NULL,
    previous_roles bytea,
    staff_id bytea NOT NULL,
    created_at bytea NOT NULL
);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: cronjobs colorcronjobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cronjobs
    ADD CONSTRAINT colorcronjobs_pkey PRIMARY KEY (id);


--
-- Name: guilds guilds_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pk PRIMARY KEY (id);


--
-- Name: guilds guilds_pk_2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pk_2 UNIQUE (id);


--
-- Name: mod_mail_threads mod_mail_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mod_mail_threads
    ADD CONSTRAINT mod_mail_threads_pkey PRIMARY KEY (thread_id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: punishments punishments_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.punishments
    ADD CONSTRAINT punishments_pk PRIMARY KEY (user_id);


--
-- PostgreSQL database dump complete
--

