const request = require('supertest');
const app = require('../service');
const { randomName } = require('../testUtils');

const { Role, DB } = require('../database/database.js');
const Test = require('supertest/lib/test.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);

  user.password = 'toomanysecrets';
  return user;
}

let testFranchise;
let adminUser;

beforeAll(async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  expect(loginRes.status).toBe(200);
  adminUser.token = loginRes.body.token;
  adminUser.id = loginRes.body.user.id;

  testFranchise = { name: randomName() + '_franchise', admins: [{ email: adminUser.email }] };
  const createRes = await request(app).post('/api/franchise').set('Authorization', 'Bearer ' + adminUser.token).send(testFranchise);
  expect(createRes.body.name).toBe(testFranchise.name);

  testFranchise.id = createRes.body.id;
});

test('list franchises', async () => {
    const listRes = await request(app).get('/api/franchise');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ name: testFranchise.name })
        ])
    )
});

test('create store', async () => {
    const store = { name: randomName() + '_store' };
    const createRes = await request(app).post('/api/franchise/' + testFranchise.id + '/store').set('Authorization', 'Bearer ' + adminUser.token).send(store);
    expect(createRes.body.name).toBe(store.name);
});

test('delete store', async () => {
    const store = { name: randomName() + '_store' };
    const createRes = await request(app).post('/api/franchise/' + testFranchise.id + '/store').set('Authorization', 'Bearer ' + adminUser.token).send(store);
    expect(createRes.body.name).toBe(store.name);

    const deleteRes = await request(app).delete('/api/franchise/' + testFranchise.id + '/store/' + createRes.body.id).set('Authorization', 'Bearer ' + adminUser.token);
    expect(deleteRes.body.message).toBe('store deleted');
    expect(deleteRes.status).toBe(200);
});

test('delete franchise', async () => {
    const newFranchise = { name: randomName() + '_franchise', admins: [{ email: adminUser.email }] };
    const createRes = await request(app).post('/api/franchise').set('Authorization', 'Bearer ' + adminUser.token).send(newFranchise);

    const deleteRes = await request(app).delete('/api/franchise/' + createRes.body.id).set('Authorization', 'Bearer ' + adminUser.token);
    expect(deleteRes.body.message).toBe('franchise deleted');
    expect(deleteRes.status).toBe(200);
})

test('list user franchises', async () => {
    const listRes = await request(app).get('/api/franchise/' + adminUser.id).set('Authorization', 'Bearer ' + adminUser.token);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ name: testFranchise.name })
        ])
    )
});