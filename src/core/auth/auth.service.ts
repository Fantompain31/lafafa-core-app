import { createClient } from '@/lib/supabase/client'
import { requireNonEmpty } from '@/shared/utils/validation'

export const authService = {
  async signInWithEmail(email: string, password: string) {
    const supabase = createClient()
    const cleanEmail = requireNonEmpty(email, 'Email').toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    if (error) throw new Error(error.message)
  },

  async signUpWithEmail(email: string, password: string, firstName: string, lastName: string) {
    const supabase = createClient()
    const cleanEmail = requireNonEmpty(email, 'Email').toLowerCase()
    const cleanFirstName = requireNonEmpty(firstName, 'Prénom')
    const cleanLastName = requireNonEmpty(lastName, 'Nom')

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          first_name: cleanFirstName,
          last_name: cleanLastName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw new Error(error.message)
  },
}
