const express = require('express');
const { registerUser, loginUser, getMe, refreshToken, revokeRefreshToken } = require('../controllers/userController');
const { protect, logout } = require('../middleware/auth');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');

const router = express.Router();

router.post('/register', validateUserRegistration, registerUser);
router.post('/login', validateUserLogin, loginUser);
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', protect, revokeRefreshToken);
router.get('/me', protect, getMe);

module.exports = router;