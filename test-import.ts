import 'dotenv/config';
async function test() {
    try {
        const { uploadToCloudinary } = await import('./server/lib/cloudinary.ts');
        console.log('Success!', typeof uploadToCloudinary);
    } catch(e) {
        console.error('Import failed!', e);
    }
}
test();
