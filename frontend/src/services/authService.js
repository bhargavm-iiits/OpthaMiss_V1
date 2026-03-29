// src/services/authService.js
// Frontend-only auth — no backend, no axios, pure localStorage.

var STORAGE_KEYS = {
    users: 'optha_users',    // { [email]: fullUserObject }
    session: 'optha_session',  // currently logged-in user (public fields)
    remember: 'optha_remember_me',
    email: 'optha_remembered_email',
};

/* ─────────────────────────────────────────
   Internal DB helpers
───────────────────────────────────────── */
var _getUsers = function () {
    try {
        var raw = localStorage.getItem(STORAGE_KEYS.users);
        return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
};

var _saveUsers = function (users) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
};

/* Strip password before exposing to UI */
var _toPublic = function (u) {
    return {
        id: u.id || '',
        email: u.email || '',
        name: u.name || '',
        phone: u.phone || '',
        provider: u.provider || 'email',
        picture: u.picture || null,
        bloodGroup: u.bloodGroup || '',
        age: u.age || '',
        occupation: u.occupation || '',
        location: u.location || null,
        profileComplete: u.profileComplete || false,
    };
};

var _makeResponse = function (user) {
    return {
        access_token: 'local-token',
        refresh_token: 'local-refresh',
        token_type: 'bearer',
        user: _toPublic(user),
    };
};

/* ─────────────────────────────────────────
   tokenStore  (keeps AuthContext happy)
───────────────────────────────────────── */
export var tokenStore = {
    getAccess: function () {
        return localStorage.getItem(STORAGE_KEYS.session) ? 'local-token' : null;
    },
    getRefresh: function () { return null; },

    getUser: function () {
        try {
            var raw = localStorage.getItem(STORAGE_KEYS.session);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    },

    setTokens: function (access, refresh, user, remember) {
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(user));
        if (remember) {
            localStorage.setItem(STORAGE_KEYS.remember, '1');
            localStorage.setItem(STORAGE_KEYS.email, user.email || '');
        } else {
            localStorage.removeItem(STORAGE_KEYS.remember);
        }
    },

    clear: function () {
        localStorage.removeItem(STORAGE_KEYS.session);
        localStorage.removeItem(STORAGE_KEYS.remember);
    },

    getRememberedEmail: function () {
        return localStorage.getItem(STORAGE_KEYS.email) || '';
    },
    isRemembered: function () {
        return localStorage.getItem(STORAGE_KEYS.remember) === '1';
    },
};

/* ─────────────────────────────────────────
   parseError
───────────────────────────────────────── */
export var parseError = function (err) {
    if (err && err.message) return err.message;
    return 'An unexpected error occurred.';
};

/* ─────────────────────────────────────────
   authService
───────────────────────────────────────── */
export var authService = {

    /* ── REGISTER ── */
    register: async function (email, password, name) {
        var cleanEmail = (email || '').toLowerCase().trim();
        var cleanName = (name || '').trim();
        var cleanPass = (password || '');

        if (!cleanEmail) {
            throw Object.assign(new Error('Email is required.'), { response: { status: 400 } });
        }
        if (!cleanName) {
            throw Object.assign(new Error('Full name is required.'), { response: { status: 400 } });
        }
        if (cleanPass.length < 8) {
            throw Object.assign(
                new Error('Password must be at least 8 characters.'),
                { response: { status: 400 } }
            );
        }

        var users = _getUsers();

        if (users[cleanEmail]) {
            throw Object.assign(
                new Error('An account with this email already exists. Please sign in.'),
                { response: { status: 409 } }
            );
        }

        var newUser = {
            id: 'usr_' + Date.now(),
            email: cleanEmail,
            name: cleanName,          // ← exactly what the user typed
            phone: '',
            password: cleanPass,          // plain-text for demo
            provider: 'email',
            picture: null,
            bloodGroup: '',
            age: '',
            occupation: '',
            location: null,
            profileComplete: false,
            createdAt: new Date().toISOString(),
        };

        users[cleanEmail] = newUser;
        _saveUsers(users);

        return _makeResponse(newUser);
    },

    /* ── LOGIN ── */
    login: async function (email, password, rememberMe) {
        var cleanEmail = (email || '').toLowerCase().trim();
        var users = _getUsers();
        var user = users[cleanEmail];

        if (!user) {
            throw Object.assign(
                new Error('No account found with this email. Please sign up first.'),
                { response: { status: 404 } }
            );
        }

        if (user.provider && user.provider !== 'email') {
            throw Object.assign(
                new Error('This account uses ' + user.provider + ' sign-in. Please use that method.'),
                { response: { status: 400 } }
            );
        }

        if (user.password !== password) {
            throw Object.assign(
                new Error('Incorrect password. Please try again.'),
                { response: { status: 401 } }
            );
        }

        return _makeResponse(user);
    },

    /* ── GET ME (restore session) ── */
    getMe: async function () {
        var session = tokenStore.getUser();
        if (!session || !session.email) {
            throw Object.assign(new Error('Not authenticated'), { response: { status: 401 } });
        }
        // Always re-read from users DB so name is never stale
        var users = _getUsers();
        var user = users[session.email];
        if (!user) {
            throw Object.assign(new Error('User not found'), { response: { status: 401 } });
        }
        return _toPublic(user);
    },

    /* ── OAUTH (not implemented in demo) ── */
    oauthLogin: async function (email, name, picture, provider, sub) {
        var cleanEmail = (email || '').toLowerCase().trim();
        var users = _getUsers();

        if (!users[cleanEmail]) {
            users[cleanEmail] = {
                id: 'usr_' + Date.now(),
                email: cleanEmail,
                name: (name || '').trim(),
                phone: '',
                picture: picture || null,
                provider: provider || 'google',
                sub: sub || '',
                profileComplete: false,
                createdAt: new Date().toISOString(),
            };
        } else {
            if (picture) users[cleanEmail].picture = picture;
            if (name) users[cleanEmail].name = (name).trim();
        }

        _saveUsers(users);
        return _makeResponse(users[cleanEmail]);
    },

    /* ── UPDATE PROFILE ── */
    updateProfile: async function (profileData) {
        var session = tokenStore.getUser();
        if (!session || !session.email) {
            throw Object.assign(new Error('Not authenticated'), { response: { status: 401 } });
        }

        var users = _getUsers();
        var user = users[session.email];
        if (!user) {
            throw Object.assign(new Error('User not found'), { response: { status: 401 } });
        }

        // Merge only provided fields
        if (profileData.name != null) user.name = (profileData.name || '').trim();
        if (profileData.phone != null) user.phone = profileData.phone;
        if (profileData.age != null) user.age = profileData.age;
        if (profileData.dateOfBirth != null) user.dateOfBirth = profileData.dateOfBirth;
        if (profileData.bloodGroup != null) user.bloodGroup = profileData.bloodGroup;
        if (profileData.occupation != null) user.occupation = profileData.occupation;
        if (profileData.city || profileData.country) {
            user.location = {
                city: profileData.city || '',
                state: profileData.state || '',
                country: profileData.country || '',
            };
        }
        user.profileComplete = true;

        users[session.email] = user;
        _saveUsers(users);

        // Update session cache with fresh public data
        var publicUser = _toPublic(user);
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(publicUser));

        return _makeResponse(user);
    },

    /* ── LOGOUT ── */
    logout: async function () {
        tokenStore.clear();
    },

    /* ── REFRESH (no-op for local auth) ── */
    refreshToken: async function () {
        var session = tokenStore.getUser();
        if (!session) throw new Error('No session');
        return _makeResponse(session);
    },
};

export default authService;