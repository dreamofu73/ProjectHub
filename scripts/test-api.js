const http = require('http');

const BASE_URL = 'http://localhost:8000/api';
let token = '';
let projectId = '';
let issueId = '';

async function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🚀 Starting API Tests against PostgreSQL Backend...\n');

    try {
        // 1. Login
        console.log('1. Testing Authentication (Login)...');
        const loginRes = await request('POST', '/auth/login', {
            login: 'admin',
            password: 'urpsys12!@'
        });
        
        if (loginRes.status === 200 && loginRes.data.success) {
            token = loginRes.data.token;
            console.log('   ✅ Login successful. Token received.');
        } else {
            throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
        }

        // 2. Get Current User (Me)
        console.log('\n2. Testing Get Current User (/auth/me)...');
        const meRes = await request('GET', '/auth/me');
        if (meRes.status === 200 && meRes.data.success) {
            console.log(`   ✅ User retrieved: ${meRes.data.data.login}`);
        } else {
            throw new Error(`Get user failed: ${JSON.stringify(meRes.data)}`);
        }

        // 3. Create Project
        console.log('\n3. Testing Project Creation...');
        const projectIdentifier = `test-proj-${Date.now()}`;
        const createProjRes = await request('POST', '/projects', {
            name: 'Test Project',
            identifier: projectIdentifier,
            description: 'A project created by automated tests',
            is_public: true
        });
        
        if (createProjRes.status === 200 && createProjRes.data.success) {
            projectId = createProjRes.data.id;
            console.log(`   ✅ Project created with ID: ${projectId}`);
        } else {
            throw new Error(`Project creation failed: ${JSON.stringify(createProjRes.data)}`);
        }

        // 4. Get Projects
        console.log('\n4. Testing Get Projects List...');
        const getProjRes = await request('GET', '/projects');
        if (getProjRes.status === 200 && getProjRes.data.success) {
            const found = getProjRes.data.data.find(p => p.id === projectId);
            if (found) {
                console.log(`   ✅ Project found in list: ${found.name}`);
            } else {
                throw new Error('Created project not found in list');
            }
        } else {
            throw new Error(`Get projects failed: ${JSON.stringify(getProjRes.data)}`);
        }

        // 5. Create Issue
        console.log('\n5. Testing Issue Creation...');
        const createIssueRes = await request('POST', '/issues', {
            project_id: projectId,
            subject: 'Test Issue',
            description: 'This is a test issue',
            tracker: 'bug',
            status: 'new',
            priority: 'normal'
        });
        
        if (createIssueRes.status === 200 && createIssueRes.data.success) {
            issueId = createIssueRes.data.id;
            console.log(`   ✅ Issue created with ID: ${issueId}`);
        } else {
            throw new Error(`Issue creation failed: ${JSON.stringify(createIssueRes.data)}`);
        }

        // 6. Get Issues
        console.log('\n6. Testing Get Issues List...');
        const getIssuesRes = await request('GET', `/issues?project_id=${projectId}`);
        if (getIssuesRes.status === 200 && getIssuesRes.data.success) {
            const found = getIssuesRes.data.data.find(i => i.id === issueId);
            if (found) {
                console.log(`   ✅ Issue found in list: ${found.subject}`);
            } else {
                throw new Error('Created issue not found in list');
            }
        } else {
            throw new Error(`Get issues failed: ${JSON.stringify(getIssuesRes.data)}`);
        }

        console.log('\n🎉 All core API tests passed successfully!');
        console.log('   PostgreSQL integration is working correctly.');

    } catch (error) {
        console.error('\n❌ Test Failed!');
        console.error(error.message);
        process.exit(1);
    }
}

runTests();
