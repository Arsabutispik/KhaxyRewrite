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
-- Name: jsonb_remove_array_element(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: set_expiry_date(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_expiry_date() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    IF (SELECT default_expiry FROM guilds WHERE id = NEW.guild_id) = 0 THEN

        NEW.expires_at := NULL;

    ELSE

        NEW.expires_at := NOW() + (INTERVAL '1 day' * (SELECT default_expiry FROM guilds WHERE id = NEW.guild_id));

    END IF;

    RETURN NEW;

END;

$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cronjobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cronjobs (
    id character varying NOT NULL,
    color_time timestamp without time zone NOT NULL,
    unregistered_people_time date
);


--
-- Name: guilds; Type: TABLE; Schema: public; Owner: -
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
    join_channel character varying,
    register_join_channel character varying,
    join_message text,
    register_join_message text,
    leave_channel character varying,
    leave_message text,
    staff_role character varying,
    male_role character varying,
    female_role character varying,
    register_channel_clear boolean,
    mod_mail_channel character varying,
    dj_role character varying,
    mod_mail_message text DEFAULT 'Thank you for your message! Our mod team will reply to you here as soon as possible.'::text,
    default_expiry integer DEFAULT 0
);


--
-- Name: infractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infractions (
    guild_id character varying NOT NULL,
    user_id character varying NOT NULL,
    moderator_id character varying NOT NULL,
    reason text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    case_id integer,
    type character varying
);


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
    expires timestamp without time zone NOT NULL,
    type character varying NOT NULL,
    user_id character varying NOT NULL,
    guild_id character varying NOT NULL,
    previous_roles text[],
    staff_id character varying NOT NULL,
    created_at timestamp without time zone NOT NULL
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
-- Name: guilds guilds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guilds
    ADD CONSTRAINT guilds_pkey PRIMARY KEY (id);


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
-- Name: infractions infractions_expiry_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER infractions_expiry_trigger BEFORE INSERT ON public.infractions FOR EACH ROW EXECUTE FUNCTION public.set_expiry_date();


--
-- Name: infractions infractions_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infractions
    ADD CONSTRAINT infractions_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.guilds(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

