/** Clipboard access happens only on an explicit paste; animation still passes byte validation. */
export function pastedChatGif(files:ArrayLike<File>|null|undefined):File|null{
 if(!files?.length)return null
 if(files.length!==1)throw Error('Paste one GIF at a time.')
 const file=files[0]
 if(file.type!=='image/gif' && (file.type!=='' || !/\.gif$/i.test(file.name)))throw Error('This paste is not an original GIF. Choose a saved GIF, or use Choose photo for a still image.')
 return file
}
