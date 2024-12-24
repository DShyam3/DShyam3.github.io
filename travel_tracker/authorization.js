import { supabase } from './supabaseClient.js';

// Password validation function
function validatePassword(password) {
  const requirements = {
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    length: password.length >= 6
  };

  const missingRequirements = [];
  if (!requirements.uppercase) missingRequirements.push('uppercase letter');
  if (!requirements.lowercase) missingRequirements.push('lowercase letter');
  if (!requirements.number) missingRequirements.push('number');
  if (!requirements.special) missingRequirements.push('special character');
  if (!requirements.length) missingRequirements.push('minimum 6 characters');

  return {
    isValid: Object.values(requirements).every(Boolean),
    missingRequirements
  };
}

export async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error: error.message };
    }

    return { user: data.user };
  } catch (err) {
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function signup(email, password) {
  try {
    // Validate password
    const { isValid, missingRequirements } = validatePassword(password);
    if (!isValid) {
      return { 
        error: `Password must contain: ${missingRequirements.join(', ')}`
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm.html`
      }
    });

    if (error) {
      return { error: error.message };
    }

    return {
      user: data.user,
      message: 'Please check your email for the confirmation link.'
    };
  } catch (err) {
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    });

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function checkConfirmationStatus(email) {
  try {
    // Get the user's session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { status: 'not_found' };
    }

    // Get user metadata
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('Error getting user:', error?.message);
      return { status: 'unknown' };
    }

    if (user.email_confirmed_at) {
      return { status: 'confirmed' };
    }

    if (user.created_at) {
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);

      return {
        status: 'pending',
        sentAt: user.created_at,
        hoursSinceSent: hoursSinceCreated
      };
    }

    return { status: 'not_sent' };
  } catch (err) {
    console.error('Error in checkConfirmationStatus:', err);
    return { status: 'unknown' };
  }
}

export async function checkUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (err) {
    console.error('Error checking user:', err.message);
    return null;
  }
}

export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (err) {
    console.error('Error during logout:', err.message);
  }
}
