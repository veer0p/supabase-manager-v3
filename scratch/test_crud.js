
const BASE_URL = "http://localhost:4000/api";
const HEADERS = { "Authorization": "Bearer visitor_token", "Content-Type": "application/json" };

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function testCrud() {
    const project_name = `testcrud${Date.now()}`;
    const node_id = "dce10f84-50e9-4219-a295-0b1bf93f8079";
    
    console.log(`🚀 Starting CRUD test for ${project_name}...`);
    
    // 1. Deploy
    console.log("Deploying...");
    try {
        const resp = await fetch(`${BASE_URL}/deploy`, { 
            method: 'POST', 
            body: JSON.stringify({ project_name, nodeId: node_id }),
            headers: HEADERS
        });
        if (!resp.ok) throw new Error(await resp.text());
    } catch (e) {
        console.error(`❌ Deploy failed: ${e.message}`);
        return;
    }
    
    // 2. Poll Status
    console.log("Polling for active status (timeout 10m)...");
    const startTime = Date.now();
    let success = false;
    while (Date.now() - startTime < 600000) {
        try {
            const resp = await fetch(`${BASE_URL}/instances`, { headers: HEADERS });
            const instances = await resp.json();
            if (instances[project_name]) {
                const status = instances[project_name].status;
                console.log(`Status: ${status}`);
                if (status === 'active') {
                    console.log("✅ Deployment successful!");
                    success = true;
                    break;
                }
                if (status === 'error') {
                    console.log("❌ Deployment failed with status ERROR");
                    const logResp = await fetch(`${BASE_URL}/logs/${project_name}`, { headers: HEADERS });
                    const logData = await logResp.json();
                    console.log(`LOGS:\n${logData.logs}`);
                    break;
                }
            } else {
                console.log("Project not found in list yet...");
            }
        } catch (e) {
            console.error(`Error polling: ${e.message}`);
        }
        await sleep(10000);
    }
    
    if (!success) {
        console.error("❌ Test failed during deployment.");
        return;
    }
    
    // 3. Delete
    console.log("Deleting...");
    try {
        const resp = await fetch(`${BASE_URL}/delete`, { 
            method: 'POST', 
            body: JSON.stringify({ project_name }),
            headers: HEADERS
        });
        if (!resp.ok) throw new Error(await resp.text());
    } catch (e) {
        console.error(`❌ Delete failed: ${e.message}`);
        return;
    }
    
    console.log("Polling for deletion...");
    const deleteStartTime = Date.now();
    while (Date.now() - deleteStartTime < 300000) {
        try {
            const resp = await fetch(`${BASE_URL}/instances`, { headers: HEADERS });
            const instances = await resp.json();
            if (!instances[project_name]) {
                console.log("✅ Deletion successful!");
                return;
            }
        } catch (e) {
            console.error(`Error polling delete: ${e.message}`);
        }
        await sleep(10000);
    }
    console.error("❌ Deletion timed out");
}

testCrud();
