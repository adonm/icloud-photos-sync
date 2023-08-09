import {LIBRARY_ERR} from "../../../app/error/error-codes.js";
import {iCPSError} from "../../../app/error/error.js";
import {CPLAlbum} from "../../icloud/icloud-photos/query-parser.js";
import {STASH_DIR} from "../constants.js";
import {PEntity} from "./photos-entity.js";

/**
 * Potential AlbumTypes
 */
export enum AlbumType {
    FOLDER = 3,
    ALBUM = 0,
    ARCHIVED = 99
}

/**
 * This type is mapping the filename in the asset folder, to the filename how the asset should be presented to the user
 * Key: Asset.getAssetFilename, Value: Asset.getPrettyFilename
 */
export type AlbumAssets = {
    [key: string]: string
}

/**
 * This class represents a photo album within the library
 */
export class Album implements PEntity<Album> {
    /**
     * UUID of this album
     */
    uuid: string;
    /**
     * Album type of this album
     */
    albumType: AlbumType;
    /**
     * The name of this album
     */
    albumName: string;
    /**
     * Assets, where the key is the uuid & the value the filename
     */
    assets: AlbumAssets;
    /**
     * UUID of parent folder
     */
    parentAlbumUUID: string;

    /**
     * Constructs a new album
     * @param uuid - The UUID of the album
     * @param albumType - The album type of the album
     * @param albumName - The album name of the album
     * @param parentAlbumUUID - The UUID of the parent album
     */
    constructor(uuid: string, albumType: AlbumType, albumName: string, parentAlbumUUID: string) {
        this.uuid = uuid;
        this.albumType = albumType;
        this.albumName = albumName;
        this.parentAlbumUUID = parentAlbumUUID;
        this.assets = {};
    }

    /**
     *
     * @returns The display name of this album instance
     */
    getDisplayName(): string {
        return this.albumName;
    }

    /**
     *
     * @returns A valid filename, that will be used to store the album on disk
     */
    getSanitizedFilename(): string {
        return this.albumName.replaceAll(`/`, `_`);
    }

    /**
     *
     * @returns The UUID of this album instance
     */
    getUUID(): string {
        return this.uuid;
    }

    /**
     * Creates an album form a CPLAlbum instance (as returned from the backend)
     * @param cplAlbum - The album retrieved from the backend
     * @returns An Album based on the CPL object
     */
    static fromCPL(cplAlbum: CPLAlbum): Album {
        const album = new Album(
            cplAlbum.recordName,
            cplAlbum.albumType,
            Buffer.from(cplAlbum.albumNameEnc, `base64`).toString(`utf8`),
            cplAlbum.parentId ? cplAlbum.parentId : ``,
        );
        album.assets = cplAlbum.assets ?? {};
        return album;
    }

    /**
     * Creates a dummy root album that is used to load all other albums from disk
     * @returns The dummy root album
     */
    static getRootAlbum(): Album {
        return new Album(``, AlbumType.FOLDER, `iCloud Photos Library`, ``);
    }

    /**
     * Creates a dummy stash album tat is used to load all albums currently within the stash album
     * @returns The dummy stash album
     */
    static getStashAlbum(): Album {
        return new Album(STASH_DIR, AlbumType.FOLDER, `iCloud Photos Library Archive`, ``);
    }

    /**
     *
     * @param album - An album to compare to this instance
     * @returns True if provided album is equal to this instance (based on UUID, AlbumType, AlbumName, Parent UUID & list of associated assets) - In case either of the albumTypes is archived, the list of assets will be ignored
     */
    equal(album: Album): boolean {
        return album
            && this.uuid === album.uuid
            && this.getSanitizedFilename() === album.getSanitizedFilename()
            && this.parentAlbumUUID === album.parentAlbumUUID
            && ( // If any of the albumTypes is ARCHIVED we will ignore asset and albumType equality
                this.albumType === AlbumType.ARCHIVED || album.albumType === AlbumType.ARCHIVED
                || (
                    this.assetsEqual(album.assets)
                    && this.albumType === album.albumType
                )
            );
    }

    /**
     * Checks of the assets, attached to this album are equal to the provided assets
     * @param assets - The list of assets to compare to
     * @returns True, if the assets are equal (order does not matter)
     */
    assetsEqual(assets: AlbumAssets) {
        // Assets might be undefined
        const thisAssets = this.assets ? this.assets : {};
        const otherAssets = assets ? assets : {};
        return JSON.stringify(Object.keys(thisAssets).sort()) === JSON.stringify(Object.keys(otherAssets).sort());
    }

    /**
     * Should only be called on a 'remote' entity. Will apply the local entity's properties to the remote one
     * @param localEntity - The local entity
     * @returns This object with the applied properties
     */
    apply(localEntity: Album): Album {
        if (!localEntity) {
            return this;
        }

        this.albumType = localEntity.albumType;
        return this;
    }

    /**
     * Check if a given album is in the chain of ancestors
     * @param potentialAncestor - The potential ancestor for the given album
     * @param fullQueue - The full list of albums
     * @returns True if potentialAncestor is part of this album's directory tree
     */
    hasAncestor(potentialAncestor: Album, fullQueue: Album[]): boolean {
        if (this.parentAlbumUUID === ``) { // If this is a root album, the potentialAncestor cannot be a ancestor
            return false;
        }

        if (potentialAncestor.getUUID() === this.parentAlbumUUID) { // If the ancestor is the parent, return true
            return true;
        }

        // Find actual parent
        const parent = fullQueue.find(album => album.getUUID() === this.parentAlbumUUID);
        // If there is a parent, check if it has the ancestor
        if (parent) {
            return parent.hasAncestor(potentialAncestor, fullQueue);
        }

        // If there is no parent, this means the queue has a gap and all we can assume is, that the ancestor is false
        return false;
    }

    /**
     * Calculates the distance to the root folder in order to compare the album's order.
     * @param album - The album, whose depth needs to be calculated
     * @param fullQueue - The list of all albums
     * @returns The number of albums between the given album and the root album
     * @throws A LibraryError, in case there is no link from the given album to root
     */
    static distanceToRoot(album: Album, fullQueue: Album[]): number {
        if (album.parentAlbumUUID === ``) {
            return 0;
        }

        const parent = fullQueue.find(potentialParent => potentialParent.getUUID() === album.parentAlbumUUID);
        if (parent) {
            return Album.distanceToRoot(parent, fullQueue) + 1;
        }

        throw new iCPSError(LIBRARY_ERR.NO_DISTANCE_TO_ROOT);
    }
}