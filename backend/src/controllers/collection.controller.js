import crypto from 'node:crypto'
import {
  addCollectionDocument, createCollection, createSection, discoverCollections, findPublishedCollectionBySlug,
  getManagedCollection, listOwnCollections, removeCollectionDocument, removeSection, renameSection,
  saveCollectionOrder, setCollectionCoverAsset, setCollectionLifecycle, updateCollection
} from '../repositories/collection.repository.js'
import { findFileAssetById, getOrCreateFileAsset } from '../repositories/fileAsset.repository.js'
import { findPublicDocument } from '../repositories/document.repository.js'
import { findCurrentDocumentVersion, findVersionFile } from '../repositories/documentVersion.repository.js'
import { findLectureFileByLectureId } from '../repositories/lectureFile.repository.js'
import { findSheetFileBySheetId } from '../repositories/sheetFile.repository.js'
import { recordDocumentInteraction } from '../repositories/communityInteraction.repository.js'
import { createBulkUpload, getBulkUpload, retryBulkUpload } from '../services/bulkUpload.service.js'

function imageInfo(bytes) {
  if (bytes.length >= 33 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.subarray(12,16).toString()==='IHDR' && bytes.includes(Buffer.from('IEND'))) return { mimeType:'image/png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20) }
  if (bytes.length >= 4 && bytes[0]===0xff && bytes[1]===0xd8 && bytes.at(-2)===0xff && bytes.at(-1)===0xd9) {
    let offset=2
    while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset+=1;continue}const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{mimeType:'image/jpeg',height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};if(length<2)break;offset+=2+length}
  }
  const error=new Error('Cover must be a valid PNG or JPEG image');error.status=400;throw error
}
function actor(req){return{id:req.user.id,role:req.user.role}}
export async function mine(req,res,next){try{res.json(await listOwnCollections(req.user.id))}catch(error){next(error)}}
export async function create(req,res,next){try{res.status(201).json(await createCollection(req.user.id,req.body))}catch(error){next(error)}}
export async function detail(req,res,next){try{res.json(await getManagedCollection(req.params.id,actor(req)))}catch(error){next(error)}}
export async function edit(req,res,next){try{res.json(await updateCollection(req.params.id,req.body,actor(req)))}catch(error){next(error)}}
export async function lifecycle(req,res,next){try{res.json(await setCollectionLifecycle(req.params.id,actor(req),req.params.action))}catch(error){next(error)}}
export async function addSection(req,res,next){try{res.status(201).json(await createSection(req.params.id,actor(req),req.body))}catch(error){next(error)}}
export async function editSection(req,res,next){try{res.json(await renameSection(req.params.id,req.params.sectionId,actor(req),req.body))}catch(error){next(error)}}
export async function deleteSection(req,res,next){try{res.json(await removeSection(req.params.id,req.params.sectionId,actor(req)))}catch(error){next(error)}}
export async function addDocument(req,res,next){try{res.status(201).json(await addCollectionDocument(req.params.id,actor(req),req.body))}catch(error){next(error)}}
export async function deleteDocument(req,res,next){try{res.json(await removeCollectionDocument(req.params.id,actor(req),req.params.type,req.params.documentId))}catch(error){next(error)}}
export async function saveOrder(req,res,next){try{res.json(await saveCollectionOrder(req.params.id,actor(req),req.body))}catch(error){next(error)}}
export async function discover(req,res,next){try{res.json(await discoverCollections(req.query))}catch(error){next(error)}}
export async function published(req,res,next){try{const collection=await findPublishedCollectionBySlug(req.params.slug);if(!collection)return res.status(404).json({message:'Collection not found'});res.json(collection)}catch(error){next(error)}}
export async function uploadCover(req,res,next){try{const fileData=String(req.body?.fileData??'').replace(/^data:[^;]*;base64,/,'');const bytes=Buffer.from(fileData,'base64');if(!bytes.length||bytes.length>5*1024*1024){const error=new Error('Cover must be between 1 byte and 5 MB');error.status=400;throw error}const info=imageInfo(bytes);if(info.width<1||info.height<1||info.width>6000||info.height>6000){const error=new Error('Cover dimensions must be between 1 and 6000 pixels');error.status=400;throw error}const binaryHash=crypto.createHash('sha256').update(bytes).digest('hex');const asset=await getOrCreateFileAsset({binaryHash,originalFilename:String(req.body.fileName||'collection-cover').slice(0,255),mimeType:info.mimeType,fileData:bytes});if(!asset?.id){const error=new Error('File asset persistence failed');error.code='FILE_ASSET_PERSISTENCE_ERROR';error.status=500;throw error}res.json(await setCollectionCoverAsset(req.params.id,actor(req),asset.id))}catch(error){next(error)}}
export async function removeCover(req,res,next){try{res.json(await setCollectionCoverAsset(req.params.id,actor(req),null))}catch(error){next(error)}}
export async function cover(req,res,next){try{const collection=await findPublishedCollectionBySlug(req.params.slug);if(!collection?.coverFileAssetId)return res.status(404).json({message:'Collection cover not found'});const asset=await findFileAssetById(collection.coverFileAssetId);if(!asset?.fileData)return res.status(404).json({message:'Collection cover not found'});res.setHeader('Content-Type',asset.mimeType);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, max-age=300');res.send(Buffer.from(asset.fileData))}catch(error){next(error)}}
export async function readerFile(req,res,next){try{const collection=await findPublishedCollectionBySlug(req.params.slug);if(!collection) return res.status(404).json({message:'Collection not found'});const type=String(req.params.type).toLowerCase()==='lecture'?'Lecture':String(req.params.type).toLowerCase()==='sheet'?'Sheet':'';const member=type&&collection.documents.find(document=>document.documentType===type&&document.documentId===req.params.documentId);if(!member)return res.status(404).json({message:'Document is not available in this Collection'});const document=await findPublicDocument(type,req.params.documentId,req.user.id);if(!document)return res.status(404).json({message:'Document is not available in this Collection'});const currentVersion=await findCurrentDocumentVersion(document.documentType,document.id);const file=currentVersion?await findVersionFile(currentVersion.id):document.documentType==='Lecture'?await findLectureFileByLectureId(document.id):await findSheetFileBySheetId(document.id);if(!file?.fileData)return res.status(404).json({message:'Document file unavailable'});await recordDocumentInteraction({userId:req.user.id,document,interactionType:'VIEW'});res.setHeader('Content-Type',file.mimeType||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename||'document')}`);res.send(Buffer.from(file.fileData))}catch(error){next(error)}}
export async function bulkCreate(req,res,next){try{res.status(207).json(await createBulkUpload({actorId:req.user.id,actorRole:req.user.role,body:req.body}))}catch(error){next(error)}}
export async function bulkGet(req,res,next){try{res.json(await getBulkUpload({id:req.params.id,actorId:req.user.id}))}catch(error){next(error)}}
export async function bulkRetry(req,res,next){try{res.json(await retryBulkUpload({id:req.params.id,actorId:req.user.id,actorRole:req.user.role,body:req.body}))}catch(error){next(error)}}
