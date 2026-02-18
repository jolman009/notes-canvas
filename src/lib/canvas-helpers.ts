export function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

export async function readImageFile(file: File) {
	const dataUrl = await readFileAsDataUrl(file);
	const size = await getImageSize(dataUrl);
	return {
		dataUrl,
		width: size.width,
		height: size.height,
	};
}

export function getImageSize(dataUrl: string) {
	return new Promise<{ width: number; height: number }>((resolve, reject) => {
		const image = new Image();
		image.onload = () =>
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = () => reject(new Error("Failed to read image dimensions."));
		image.src = dataUrl;
	});
}
