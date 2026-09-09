
export function getFileURL(record: { [key: string]: any; }, filename?: string, thumb?: string) {
    if (!filename) {
        return "";
    }
    if (isURL(filename)) {
        return filename;
    }

    return `/api/v1/files/${record.collectionId}/${record.id}/${filename}${thumb ? '?thumb=' + thumb : ''}`
}

export function isURL(value?: string | null): boolean {
    if (!value || typeof value !== "string") {
        return false;
    }
    // Fast-path for data: and blob: URIs
    if (value.startsWith("data:") || value.startsWith("blob:")) {
        return true;
    }
    // Fast-path: An absolute web URL must start with http://, https://, or protocol-relative //
    // Plain filenames (e.g. "photo.jpg", "cover_xxx.jpg") or icon names are not URLs
    if (!value.startsWith("http://") && !value.startsWith("https://") && !value.startsWith("//")) {
        return false;
    }
    try {
        const url = new URL(value, "http://localhost");
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

export function readAsDataURLAsync(file: File) {
    return new Promise<string>((resolve, reject) => {
        var fr = new FileReader();
        fr.onload = () => {
            resolve(fr.result as string);
        };
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
}

export function isVideoURL(url: string | null | undefined): boolean {
    if (!url) return false;
    if (url.startsWith("data:")) {
        return url.startsWith("data:video");
    }
    const lower = url.toLowerCase();
    return (
        lower.includes(".mp4") ||
        lower.includes(".webm") ||
        lower.includes(".ogg") ||
        lower.includes(".mov") ||
        lower.includes(".m4v") ||
        lower.includes(".mkv")
    );
}

export function saveAs(data: Blob, fileName: string) {
    var a = document.createElement("a") as HTMLAnchorElement;
    a.setAttribute("style", "display: none");
    document.body.appendChild(a);
    const url = window.URL.createObjectURL(data);
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
};

function buildFormData(
    formData: FormData,
    data: any,
    parentKey?: string,
    exclude: string[] = []
) {
    if (data === null || data === undefined) {
        return;
    }

    // Handle arrays
    if (Array.isArray(data)) {
        if (data.length === 0) {
            // Add an explicit empty entry for empty arrays
            formData.append(parentKey!, '');
            return;
        }

        data.forEach((value, index) => {
            const key = parentKey ? `${parentKey}` : String(index);
            buildFormData(formData, value, key, exclude);
        });
    }

    // Handle objects (but not Date, File, Blob)
    else if (
        typeof data === 'object' &&
        !(data instanceof Date) &&
        !(data instanceof File) &&
        !(data instanceof Blob)
    ) {
        Object.keys(data).forEach((key) => {
            if (exclude.includes(key)) {
                return;
            }
            const value = data[key];
            const newKey = parentKey ? `${parentKey}.${key}` : key;
            buildFormData(formData, value, newKey, exclude);
        });
    }

    // Handle primitives and special types
    else {
        const value =
            data instanceof Date
                ? data.toISOString()
                : data == null
                    ? ''
                    : data;

        formData.append(parentKey!, value);
    }
}

export function objectToFormData(data: Object, exclude?: string[]) {
    const formData = new FormData();

    buildFormData(formData, data, undefined, exclude);

    return formData;
}