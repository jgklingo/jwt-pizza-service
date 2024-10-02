const request = require('supertest');
const app = require('../service');
const { randomName } = require('../testUtils');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testItem;

const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);

  user.password = 'toomanysecrets';
  return user;
}
let adminUser;

beforeAll(async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  expect(loginRes.status).toBe(200);
  adminUser.token = loginRes.body.token;
  adminUser.id = loginRes.body.user.id;

  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expect(testUserAuthToken).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  testItem = { menuId: 1, description: 'Veggie', price: 0.05 };
  await request(app).put('/api/order/menu').set('Authorization', 'Bearer ' + adminUser.token).send(testItem);
});

test('order test', async () => {
    });