import { uploadToCloudinary } from './server/lib/cloudinary.js';
import 'dotenv/config';

async function test() {
    try {
        console.log('Testing upload...');
        const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const dataUrl = \data:image/png;base64,\\;
        const url = await uploadToCloudinary(dataUrl, 'test');
        console.log('Success:', url);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
