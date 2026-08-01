const http = require('http');

const BASE_URL = 'http://localhost:8000/api';

async function request(method, path, body = null, token = null) {
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

const trackers = ['bug', 'feature', 'support'];
const statuses = ['new', 'in_progress', 'resolved', 'closed'];
const priorities = ['low', 'normal', 'high', 'urgent'];

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
    let token = '';
    
    let loginRes = await request('POST', '/auth/login', {
        login: 'admin',
        password: 'admin123'
    });

    if (loginRes.status !== 200 || !loginRes.data.success) {
        console.log("Trying alternative password...");
        loginRes = await request('POST', '/auth/login', {
            login: 'admin',
            password: 'Hek+dmHXEoROQIXPnSpM5RPU6F/raEMF'
        });
    }

    if (loginRes.status === 200 && loginRes.data.success) {
        token = loginRes.data.token;
        console.log('Login successful.');
    } else {
        console.error('Login failed.');
        process.exit(1);
    }

    for (let p = 1; p <= 10; p++) {
        const identifier = `test-proj-bulk-${Date.now()}-${p}`;
        const name = `테스트용 프로젝트 ${p} (${Date.now()})`;
        
        console.log(`Creating project: ${name}...`);
        const projRes = await request('POST', '/projects', {
            name: name,
            identifier: identifier,
            description: `자동 생성된 테스트용 프로젝트 ${p}입니다.`,
            is_public: true
        }, token);

        if (projRes.status !== 200 || !projRes.data.success) {
            console.error(`Failed to create project ${p}:`, projRes.data);
            continue;
        }

        const projectId = projRes.data.id;
        console.log(`  -> Created Project ID: ${projectId}. Now creating 50 issues...`);

        let issuesCreated = 0;
        for (let i = 1; i <= 50; i++) {
            const tracker = randomItem(trackers);
            const status = randomItem(statuses);
            const priority = randomItem(priorities);
            
            const issueRes = await request('POST', '/issues', {
                project_id: projectId,
                subject: `다양한 테스트 이슈 #${i} [${tracker}]`,
                description: `자동 생성된 이슈 내용입니다.\\n우선순위: ${priority}\\n상태: ${status}`,
                tracker: tracker,
                status: status,
                priority: priority
            }, token);

            if (issueRes.status === 200 && (issueRes.data.success === true || issueRes.data.success === 'True' || issueRes.data.success === 'true')) {
                issuesCreated++;
            } else if (issueRes.status === 200 && issueRes.data.id) {
                issuesCreated++;
            } else {
                console.error(`  -> Failed to create issue ${i}:`, issueRes.data);
            }
        }
        console.log(`  -> Successfully created ${issuesCreated} issues for project ${projectId}.`);
    }

    console.log("All projects and issues have been generated successfully.");
}

run();
