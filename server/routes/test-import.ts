async function test() {
    try {
        const { uploadToCloudinary } = await import('../lib/cloudinary.js');
        console.log('Success!', typeof uploadToCloudinary);
    } catch(e) {
        console.error('Import failed!', e);
    }
}
test();
