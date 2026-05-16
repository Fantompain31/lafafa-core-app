import { createClient } from '@/lib/supabase/client'
import { requireNonEmpty } from '@/shared/utils/validation'

export const authService = {
  async signInWithEmail(email: string, password: string) {
    const supabase = createClient()
    const cleanEmail = requireNonEmpty(email, 'Email').toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    if (error) throw new Error(error.message)
  },

  async signUpWithEmail(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    redirectTo?: string,
  ) {
    const supabase = createClient()
    const cleanEmail = requireNonEmpty(email, 'Email').toLowerCase()
    const cleanFirstName = requireNonEmpty(firstName, 'Prénom')
    const cleanLastName = requireNonEmpty(lastName, 'Nom')

    // Si redirectTo fourni, on le passe dans le callback pour revenir au lien d'invitation
    const callbackUrl = redirectTo
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
      : `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          first_name: cleanFirstName,
          last_name: cleanLastName,
        },
        emailRedirectTo: callbackUrl,
      },
    })
    if (error) throw new Error(error.message)
  },
}
