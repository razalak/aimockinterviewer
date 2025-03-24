import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const models = [
  {
    name: 'tiny_face_detector_model-weights_manifest.json',
    url: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/tiny_face_detector_model-weights_manifest.json'
  },
  {
    name: 'tiny_face_detector_model-shard1',
    url: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/tiny_face_detector_model-shard1'
  },
  {
    name: 'face_expression_model-weights_manifest.json',
    url: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/face_expression_model-weights_manifest.json'
  },
  {
    name: 'face_expression_model-shard1',
    url: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/face_expression_model-shard1'
  }
];

const modelsDir = path.join(__dirname, '../public/models');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(modelsDir, filename);
    const file = fs.createWriteStream(filepath);
    
    https.get(url, response => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded: ${filename}`);
          resolve();
        });
      } else {
        file.close();
        fs.unlink(filepath, () => reject(new Error(`Failed to download ${filename}: ${response.statusCode}`)));
      }
    }).on('error', err => {
      file.close();
      fs.unlink(filepath, () => reject(err));
    });
  });
}

async function downloadAllModels() {
  try {
    for (const model of models) {
      await downloadFile(model.url, model.name);
    }
    console.log('All models downloaded successfully!');
  } catch (error) {
    console.error('Error downloading models:', error);
  }
}

downloadAllModels(); 