// OAuth callback - exchange code for tokens
export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/confirm.html?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/confirm.html?auth_error=no_code');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Token error:', tokens);
      return res.redirect(`/confirm.html?auth_error=${encodeURIComponent(tokens.error)}`);
    }

    // Get user info to display their email
    let userEmail = '';
    try {
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userResponse.json();
      userEmail = userInfo.email || '';
    } catch (e) {
      console.error('Failed to get user info:', e);
    }

    // Decode the original return URL from state
    const returnTo = state ? decodeURIComponent(state) : '/confirm.html';

    // Build redirect URL with tokens as hash params (not exposed to server)
    const redirectUrl = new URL(returnTo, `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`);
    
    // Pass tokens via hash fragment (client-side only, more secure)
    const hashParams = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expires_in: tokens.expires_in || '3600',
      user_email: userEmail,
    });

    res.redirect(302, `${redirectUrl.pathname}${redirectUrl.search}#${hashParams.toString()}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`/confirm.html?auth_error=${encodeURIComponent(error.message)}`);
  }
}
