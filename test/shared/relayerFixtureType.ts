import { relayerFixture } from './fixtures'
import { LoadFixture } from './setup'

//Return type of relayerFixture + loadFixture
//load fixtures one time to save case execution time
export type RelayerFixture = (ReturnType<typeof relayerFixture> extends Promise<infer U> ? U : any) &
  (ReturnType<LoadFixture> extends Promise<infer U> ? U : any)
