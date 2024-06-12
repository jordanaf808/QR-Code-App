// This route uses a dynamic segment to match the URL for creating a new QR code and editing an existing one.
// If the user is creating a QR code, the URL is /app/qrcodes/new. If the user is updating a QR code, the URL is /app/qrcodes/1, where 1 is the ID of the QR code that the user is updating.

import { useState } from "react";
import { json } from "@remix-run/node";

import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";

import { authenticate } from "../shopify.server";

import {
  Card,
  Bleed,
  Button,
  ChoiceList,
  Divider,
  EmptyState,
  InlineStack,
  InlineError,
  Layout,
  Page,
  Text,
  TextField,
  Thumbnail,
  BlockStack,
  PageActions,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

import db from '../db.server'
import { getQRCode, validateQRCode } from "../models/QRCode.server";
// Authenticate user
// If the user isn't authenticated, authenticate.admin handles the necessary redirects. If the user is authenticated, then the method returns an admin object.
export async function loader({request, params}){
  console.log('app/qrcodes/$id', params);
  console.log('request', request);
  const { admin } = await authenticate.admin(request)

  console.log('app/qrcodes/$id auth recieved');

  // return JSON response to populate the QR code (form) state.
  if(params.id === 'new'){
    return json({
      destination: 'product',
      title: ''
    })
  }

  console.log('get qr code');
  // return the JSON from getQRCode 
  return json(await getQRCode(Number(params.id), admin.graphql))
}

/* CRUD actions for QR Codes */
export async function action({request, params}){
  console.log('action, params: ', params)
  const { session, redirect } = await authenticate.admin(request)
  console.log('action auth recieved: ', redirect)
  const { shop } = session

  /*** @type {any} ***/
  const data = {
    ...Object.fromEntries(await request.formData()),
    shop
  }

  /* DELETE */
  if(data.action === 'delete'){
    await db.qRCode.delete({
      where: {
        id: Number(params.id)
      }
    })
    return redirect("/app");
  }

  /* ERRORS */
  const errors = validateQRCode(data)
  if(errors){
    return json({errors}, {staus: 422})
  }

  /* CREATE or UPDATE */
  const qrCode = params.id === 'new' ? await db.qRCode.create({data}) : await db.qRCode.update({where: {id: Number(params.id)}, data})

  /* redirect to qrcode page */
  return redirect(`/app/qrcodes/${qrCode.id}`)
}

// Manage Form State
export default function QRCodeForm(){
  console.log('QRCode Form');
  // If the user doesn't fill all of the QR code form fields, then the action returns errors to display. This is the return value of validateQRCode, through the Remix useActionData hook.
  const errors = useActionData()?.errors || {}

  const qrCode = useLoaderData()
  // The current state of the form
  const [formState, setFormState] = useState(qrCode);
  // The initial state of the form
  const [cleanFormState, setCleanFormState] = useState(qrCode)
  // Determines if the form has changed
  const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState)

  // track form submitting state
  const nav = useNavigation()
  const isSaving = nav.state === 'submitting' && nav.formData?.get('action') !== 'delete'
  const isDeleting = nav.state === 'submitting' && nav.formData?.get('action') === 'delete'

  const navigate = useNavigate()
  console.log('navigate', navigate);

  // the App Bridge `resourcePicker` action, add a modal that allows the user to select a product.
  async function selectProduct(){
    console.log('selectProduct()')
    const products = await window.shopify.resourcePicker({
      type: 'product',
      action: 'select' //customized action verb, either 'select' or 'add'
    })

    console.log('selectProduct() products: ', products)
    // Save the selection to form state.
    if(products){
      const {images, id, variants, title, handle} = products[0]
      setFormState({
        ...formState,
        productId: id,
        productVariantId: variants[0].id,
        productTitle: title,
        productHandle: handle,
        productAlt: images[0]?.altText,
        productImage: images[0]?.originalSrc
      })
    }
  }

  // Remix hook to save the form data.
  const submit = useSubmit()
  function handleSave(){
    const data = {
      title: formState.title,
      productId: formState.productId || '',
      productVariantId: formState.productVariantId || '',
      productHandle: formState.productHandle || '',
      destination: formState.destination
    }

    // Set the initial state of the form to the submitted product
    setCleanFormState({...formState})
    submit(data, {method: 'post'})
  }
  
  // Using Polaris components, build the layout for the form. 
  return (
    <Page>
      {/* Use an App Bridge ui-title-bar action to display a title that indicates to the user whether they're creating or editing a QR code. Include a breadcrumb link to go back to the QR code list. */}
      <ui-title-bar title={qrCode.id ? 'Edit QR code' : 'Create new QR code'}>
        <button variant='breadcrumb' onClick={() => navigate('/app/qrcodes')}>QR codes</button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap='500'>
            {/* Title Field */}
            <Card>
              <BlockStack gap='500'>
                <Text as={'h2'} variant='headingLg'>Title</Text>
                <TextField
                  id='title'
                  helpText='Only store staff can see this title'
                  label='title'
                  labelHidden
                  autoComplete='off'
                  value={formState.title}
                  onChange={(title) => setFormState({...formState, title})}
                  error={errors.title}
                />
              </BlockStack>
            </Card>
            {/* Select Product Field */}
            <Card>
              <BlockStack gap='500'>
                <InlineStack align='space-between'>
                  <Text as={'h2'} variant='headingLg'>Product</Text>
                  {formState.productId ? (
                    <Button variant='plain' onClick={selectProduct}>
                      Change Product
                    </Button>
                  ) : null}
                </InlineStack>
                {formState.productId ? (
                  <InlineStack variant='plain' onClick={selectProduct}>
                    <Thumbnail
                      source={formState.productImage || ImageIcon}
                      alt={formState.productAlt}
                    />
                    <Text as='span' variant='headingMd' fontWeight='semibold'>
                      {formState.productTitle}
                    </Text>
                  </InlineStack>
                ) : (
                  <BlockStack gap='200'>
                    <Button onClick={selectProduct} id='select-product'>Select Product</Button>
                    {errors.productId ? (
                      <InlineError
                        message={errors.productId}
                        fieldID="myFieldID"
                      />
                    ) : null}
                  </BlockStack>
                )}
                <Bleed marginInlineStart='200' marginInlineEnd='200'>
                  <Divider />
                </Bleed>
                {/* QR Code link destination field*/}
                <InlineStack gap='500' align='space-between' blockAlign='start'>
                  <ChoiceList
                    title='Scan Destination'
                    choices={[
                      {label: 'Link to product page', value: 'product'},
                      {label: 'Link to checkout page with product in the cart', value: 'cart'}
                    ]}
                    selected={[formState.destination]}
                    onChange={(destination) => (
                      setFormState({
                        ...formState,
                        destination: destination[0]
                      })
                    )}
                    error={errors.destination}
                  />
                  {qrCode.destinationUrl ? (
                    <Button
                      variant='plain'
                      url={qrCode.destinationUrl}
                      target='_blank'
                    >
                      Go to destination URL
                    </Button>
                  ) : null}
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant='oneThird'>
          {/* Preview QR code */}
          <Card>
            <Text as={'h2'} variant='headingLg'>
              QR code
            </Text>
            {qrCode ? (
              <EmptyState image={qrCode.image} imageContained={true} />
            ) : (
              <EmptyState image=''>
                Your QR code will appear here after you save
              </EmptyState>
            )}
            <BlockStack gap='300'>
              <Button
                disabled={!qrCode?.image}
                url={qrCode?.image}
                download
                variant='primary'
              >
                Download
              </Button>
              <Button
                disabled={!qrCode.id}
                url={`/qrcodes/${qrCode.id}`}
                target='_blank'
              >
                Go to public URL
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          {/* Save or Delete Buttons */}
          <PageActions
            secondaryActions={[
              {
                content: 'Delete',
                loading: isDeleting,
                disabled: !qrCode.id || !qrCode || isSaving || isDeleting,
                destructive: true,
                outline: true,
                onAction: () => submit({action: 'delete'}, {method: 'post'}),
              },
            ]}
            primaryAction={{
              content: 'Save',
              loading: isSaving,
              disabled: !isDirty || isSaving || isDeleting,
              onAction: handleSave,
            }}
          />
        </Layout.Section>
      </Layout>
    </Page>
  )
}