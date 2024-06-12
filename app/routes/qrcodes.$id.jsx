// Create a public page to render a QR code.
import { json } from '@remix-run/node';
import invariant from 'tiny-invariant';
import { useLoaderData } from '@remix-run/react';

import db from '../db.server';
import { getQRCodeImage } from '../models/QRCode.server';

// check that there's an ID in the URL. If there isn't, throw an error using tiny-invariant.
export const loader = async ({params}) => {
  invariant(params.id, 'Could not find QR code destination');

  const id = Number(params.id);
  const qrCode = await db.qRCode.findFirst({where: {id}});

  invariant(qrCode, 'Could not find QR code destination');

  return json({
    title: qrCode.title,
    image: await getQRCodeImage(id)
  });
};

// Render a public QR code image
export default function QRCode() {
  const { image, title } = useLoaderData();

  return (
    <>
      <h1>{title}</h1>
      <img src={image} alt={`QR code for product`} />
    </>
  );
}