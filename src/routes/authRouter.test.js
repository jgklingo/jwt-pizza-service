const request = require('supertest');
const app = require('../service');
const { randomName } = require('../testUtils');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testUserId;

beforeAll(async () => {
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
  expect(testUserAuthToken).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
  expect(password).toBeTruthy();
});

test('register', async () => {
  const newUser = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
  const registerRes = await request(app).post('/api/auth').send(newUser);
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  expect(registerRes.body.user.name).toBe(newUser.name);
})

test('update user', async () => {
  const updateRes = await request(app).put('/api/auth/' + testUserId).set('Authorization', 'Bearer ' + testUserAuthToken).send({ email: 'changed@test.com', password: 'a' });
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.email).toBe('changed@test.com');
})

test('logout', async () => {
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', 'Bearer ' + testUserAuthToken);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
})