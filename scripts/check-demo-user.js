const db = require('../utils/database');

async function checkDemoUser() {
  try {
    console.log('Checking for demo user...');

    const demoUser = await db.users.findOne({ email: 'demo@example.com' });

    if (demoUser) {
      console.log('✅ Demo user found!');
      console.log('User ID:', demoUser.id);
      console.log('Name:', demoUser.name);
      console.log('Email:', demoUser.email);
      console.log('Role:', demoUser.role);
      console.log('Active:', demoUser.isActive);
    } else {
      console.log('❌ Demo user not found');
    }

    // Check total users
    const totalUsers = await db.users.count();
    console.log('Total users in database:', totalUsers);

  } catch (error) {
    console.error('Error checking demo user:', error.message);
  }
}

checkDemoUser();
