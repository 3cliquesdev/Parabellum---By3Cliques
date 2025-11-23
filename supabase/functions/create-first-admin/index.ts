import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Attempting to create admin user:', email)

    // Try to find and delete existing user with this email
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers.users.find(u => u.email === email)

      if (existingUser) {
        console.log('Found existing user, deleting:', existingUser.id)
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
        console.log('Existing user deleted successfully')
        // Wait a bit after deletion
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error('Error checking/deleting existing user:', error)
    }

    // Create the user using admin API
    console.log('Creating new user')
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: email.split('@')[0]
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      throw createError
    }

    console.log('User created successfully:', user.user?.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Admin user created successfully',
        user_id: user.user?.id
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in create-first-admin function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
