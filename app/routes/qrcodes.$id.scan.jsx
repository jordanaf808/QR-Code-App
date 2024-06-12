// Create a public page to render a QR code.
// import { redirect } from '@remix-run/node';
import invariant from 'tiny-invariant';
import db from '../db.server';
import { authenticate } from "../shopify.server";
import { getDestinationUrl } from '../models/QRCode.server';

// load the QR code from the database.
export const loader = async ({request, params}) => {
  //Validate the QR code and ID
  invariant(params.id, 'Could not find QR code destination');

  const id = Number(params.id);
  const qrCode = await db.qRCode.findFirst({where: {id}});

  invariant(qrCode, 'Could not find QR code destination');

  // If the loader returns a QR code, then increment the scan count in the database.
  await db.qRCode.update({
    where: {id},
    data: {scans: {increment: 1}}
  });

  const { redirect } = await authenticate.admin(request)

  // redirect to the destination URL for the QR code
  return redirect(getDestinationUrl(qrCode));
}