import fs from 'fs';

async function testWorkflow() {
  console.log('--- Step 1: Generating Preview for "telegram怎么用" ---');
  const previewRes = await fetch('http://localhost:3000/api/generate-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: 'telegram怎么用' })
  });

  if (!previewRes.ok) {
    const err = await previewRes.text();
    console.error('Preview failed:', previewRes.status, err);
    process.exit(1);
  }

  const previewData = await previewRes.json();
  console.log('Preview success!');
  console.log('Title:', previewData.article.title);
  console.log('Featured Image URL:', previewData.images.featured.url);
  console.log('In-Article Image URL:', previewData.images.inArticle.url);
  console.log('Content Length (characters):', previewData.article.contentHtml.length);
  console.log('Outline count:', previewData.article.outline?.length);

  fs.writeFileSync('preview_result.json', JSON.stringify(previewData, null, 2), 'utf-8');

  console.log('\n--- Step 2: Publishing to WordPress (Draft) ---');
  const publishRes = await fetch('http://localhost:3000/api/publish-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      article: previewData.article,
      images: previewData.images
    })
  });

  if (!publishRes.ok) {
    const err = await publishRes.text();
    console.error('Publish failed:', publishRes.status, err);
    process.exit(1);
  }

  const publishData = await publishRes.json();
  console.log('Publish success!');
  console.log('WordPress Post ID:', publishData.postId);
  console.log('WordPress Post Link:', publishData.postUrl);
  console.log('Status:', publishData.status);
  console.log('Featured Media ID:', publishData.featuredMediaId);
}

testWorkflow().catch(console.error);
