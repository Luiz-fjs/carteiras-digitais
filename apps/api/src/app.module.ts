import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IssuersModule } from './issuers/issuers.module';
import { CredentialsModule } from './credentials/credentials.module';
import { PresentationsModule } from './presentations/presentations.module';
import { StatusListModule } from './status-list/status-list.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    IssuersModule,
    CredentialsModule,
    PresentationsModule,
    StatusListModule,
  ],
})
export class AppModule {}
