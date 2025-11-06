import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          const existingEmailUser = await User.findOne({ 
            email: profile.emails[0].value 
          });

          if (existingEmailUser) {
            existingEmailUser.googleId = profile.id;
            existingEmailUser.emailVerified = true;
            existingEmailUser.avatar = profile.photos[0]?.value;
            await existingEmailUser.save();
            return done(null, existingEmailUser);
          }

          user = await User.create({
            googleId: profile.id,
            username: profile.displayName.replace(/\s+/g, '_').toLowerCase(),
            email: profile.emails[0].value,
            emailVerified: true,
            avatar: profile.photos[0]?.value,
            password: Math.random().toString(36).slice(-8) // Random password
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;