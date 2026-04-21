
DROP POLICY "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Users or admins can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
