-- Fix the verify_admin_login function to properly use crypt with pgcrypto
DROP FUNCTION IF EXISTS public.verify_admin_login(text, text);

CREATE OR REPLACE FUNCTION public.verify_admin_login(input_email text, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgcrypto'
AS $$
BEGIN
  -- First check if user exists with plain text password (for migration)
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = input_email 
    AND password_hash = input_password
  ) THEN
    RETURN true;
  END IF;
  
  -- Then check with proper crypt function
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = input_email 
    AND password_hash = crypt(input_password, password_hash)
  );
END;
$$;