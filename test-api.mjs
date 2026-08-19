async function test() {
    const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const payload = {
        name: 'test.png',
        data: 'data:image/png;base64,' + base64Data
    };
    try {
        const res = await fetch('http://localhost:3001/api/admin/hero/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch(e) {
        console.log('Fetch error:', e);
    }
}
test();
