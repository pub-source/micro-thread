-- Create function to verify admin login
CREATE OR REPLACE FUNCTION public.verify_admin_login(input_email text, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = input_email 
    AND password_hash = crypt(input_password, password_hash)
  );
END;
$$;