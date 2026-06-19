import * as cheerio from 'cheerio';

const res = await fetch('https://www.gsmarena.com/apple_iphone_17-14050.php', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
});

const html = await res.text();
const $ = cheerio.load(html);

console.log('Phone name:', $('h1.specs-phone-name-title').text().trim());
console.log('Spec rows:');
$('table tr').each((i, el) => {
  const label = $(el).find('td.ttl').text().trim();
  const value = $(el).find('td.nfo').text().replace(/\s+/g, ' ').trim();
  if (label && value) console.log(`  ${label}: ${value}`);
});