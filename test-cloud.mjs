import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'rla3fbe1',
  api_key: '593267839271347',
  api_secret: 'jLxqbXmBhdmPkFAopzFbZ91zIzk'
});

async function run() {
  try {
    console.log('Uploading...');
    const result = await cloudinary.uploader.upload('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', {
      folder: 'embr/test'
    });
    console.log('Success:', result.secure_url);
  } catch (err) {
    console.error('Failed:', err);
  }
}
run();
