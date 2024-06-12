import db from '../db.server';
import qrcode from 'qrcode';
import invariant from 'tiny-invariant';

export async function getQRCode(id, graphql) {
  console.log('getQRCode() id: ', id)
  const qrCode = await db.qRCode.findFirst({where: {id}});

  if(!qrCode) {
    console.log('no qrCode')
    return null;
  }

  console.log('got qrCode')
  return supplementQRCode(qrCode, graphql);
}

export async function getQRCodes(shop, graphql) {
  console.log('getQRCodes()')
  const qrCodes = await db.qRCode.findMany({
    where: {shop},
    orderBy: {id: "desc"}
  })

  if (qrCodes.length === 0) {
    console.log('no qrCodesss')
    return [];
  }

  console.log('gotQRCodes, map...')
  return Promise.all(
    qrCodes.map(qrCode => supplementQRCode(qrCode, graphql))
  );
}

export function getQRCodeImage(id) {
  const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL)
  return qrcode.toDataURL(url.href);
}

export function getDestinationUrl(qrCode) {
  if (qrCode.destination === 'product') {
    console.log('getDestinationUrl() return product url', qrCode)
    return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
  }

  const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrCode.productVariantId);

  invariant(match, 'Unrecognized product variant ID');
  console.log('id matched, retun cart url', match[1])
  return `https://${qrCode.shop}/cart/${match[1]}:1`
}

async function supplementQRCode(qrCode, graphql) {
  console.log('supplementQRCode id: ', qrCode.id)
  const qrCodeImagePromise = getQRCodeImage(qrCode.id);

  const response = await graphql(
    `
      query supplementQRCode($id: ID!) {
        product(id: $id) {
          title
          images(first: 1) {
            nodes {
              altText
              url
            }
          }
        }
      }
    `,
    {
      variables: {
        id: qrCode.productId,
      }
    }
  );

  const { data: { product } } = await response.json();

  return {
    ...qrCode,
    productDeleted: !product?.title,
    productTitle: product?.title,
    productImage: product?.images?.nodes[0]?.url,
    productAlt: product?.images?.nodes[0]?.altText,
    destinationUrl: getDestinationUrl(qrCode),
    image: await qrCodeImagePromise,
  }
}

export function validateQRCode(data) {
  const errors = {};

  if(!data.title) {
    errors.title = 'Title is required';
  }
  if(!data.productId) {
    errors.productId = 'Product is required';
  }
  if(!data.destination) {
    errors.destination = 'Destination is required';
  }
  if(Object.keys(errors).length) {
    return errors;
  }
}