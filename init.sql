--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2 (Debian 17.2-1.pgdg120+1)
-- Dumped by pg_dump version 17.2 (Debian 17.2-1.pgdg120+1)

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
-- Name: jsonb_remove_array_element(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.jsonb_remove_array_element(arr jsonb, element jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
  DECLARE _idx integer;
  DECLARE _result jsonb;
  BEGIN
    _idx := (SELECT ordinality - 1 FROM jsonb_array_elements(arr) WITH ordinality WHERE value = element);
    IF _idx IS NOT NULL 
    THEN 
      _result := arr - _idx;
    ELSE
      _result := arr;
    END IF;
    RETURN _result;
  END;
$$;


ALTER FUNCTION public.jsonb_remove_array_element(arr jsonb, element jsonb) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cronjobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cronjobs (
    id character varying NOT NULL,
    color_time timestamp without time zone NOT NULL,
    unregistered_people_time date
);


ALTER TABLE public.cronjobs OWNER TO postgres;

--
-- Name: guilds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.guilds (
    id character varying NOT NULL,
    language character varying DEFAULT 'en'::character varying,
    case_id integer DEFAULT 1,
    mod_log_channel character varying,
    color_id_of_the_day character varying,
    color_name_of_the_day character varying,
    days_to_kick integer DEFAULT 0,
    register_channel character varying,
    member_role character varying,
    mute_role character varying,
    mute_get_all_roles boolean,
    welcome_channel character varying,
    register_welcome_channel character varying,
    welcome_message character varying,
    register_welcome_message character varying,
    bump_leaderboard_channel character varying,
    default_expiry interval DEFAULT '7 days'::interval
);


ALTER TABLE public.guilds OWNER TO postgres;

--
-- Name: infractions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.infractions (
    id integer NOT NULL,
    guild_id character varying NOT NULL,
    user_id character varying NOT NULL,
    moderator_id character varying NOT NULL,
    reason text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    case_id integer,
    type character varying
);


ALTER TABLE public.infractions OWNER TO postgres;

--
-- Name: infractions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.infractions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.infractions_id_seq OWNER TO postgres;

--
-- Name: infractions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.infractions_id_seq OWNED BY public.infractions.id;


--
-- Name: punishments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.punishments (
    expires date NOT NULL,
    type character varying NOT NULL,
    user_id character varying NOT NULL,
    guild_id character varying NOT NULL,
    previous_roles jsonb,
    staff_id character varying NOT NULL,
    created_at date NOT NULL
);


ALTER TABLE public.punishments OWNER TO postgres;

--
-- Name: infractions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.infractions ALTER COLUMN id SET DEFAULT nextval('public.infractions_id_seq'::regclass);


--
-- Name: cronjobs colorcronjobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cronjobs
    ADD CONSTRAINT colorcronjobs_pkey PRIMARY KEY (id);


--
-- Name: guilds guilds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pkey PRIMARY KEY (id);


--
-- Name: infractions infractions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.infractions
    ADD CONSTRAINT infractions_pkey PRIMARY KEY (id);


--
-- Name: punishments punishments_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.punishments
    ADD CONSTRAINT punishments_pk PRIMARY KEY (user_id);


--
-- Name: infractions infractions_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.infractions
    ADD CONSTRAINT infractions_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

