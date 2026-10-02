import {
  Controller, Post, Get, Delete, Param, Query, UseInterceptors,
  UploadedFile, StreamableFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PatrolService } from './patrol.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { EvaluateQueryDto, LocalRuleDto, PatrolListQueryDto, SpotCheckSubmitQueryDto } from './dto/patrol.dto';

@Controller('patrols')
export class PatrolController {
  constructor(private readonly patrols: PatrolService) {}

  /** 巡查判定(multipart: image 文件 + sessionId + source) */
  @Post('evaluate')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  evaluate(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() q: EvaluateQueryDto,
  ) {
    if (!file) throw new BadRequestException('缺少 image 文件');
    return this.patrols.evaluate(user.id, file.buffer, q.sessionId, q.source);
  }

  /** 突击检查: 用户端查是否有待处理任务 */
  @Get('check/task')
  checkTask(@CurrentUser() user: AuthUser) {
    return this.patrols.getUserSpotTask(user.id);
  }

  /** 突击检查: 用户端提交抓帧(multipart image + taskId) */
  @Post('check/submit')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 1 * 1024 * 1024 } }))
  submitCheck(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() q: SpotCheckSubmitQueryDto,
  ) {
    if (!file) throw new BadRequestException('缺少 image 文件');
    return this.patrols.submitSpotCheck(user.id, file.buffer, q.taskId, q.source ?? 'camera');
  }

  /**
   * 本地规则判定落库(前端规则分流: 遮挡类 camera 直接判 away)
   * image 可选: 违纪帧随传则自动留存违纪快照(留档自动上传后端)
   */
  @Post('local-rule')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  localRule(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() q: LocalRuleDto,
  ) {
    return this.patrols.localRule(user.id, q.sessionId, q.source, q.rule, q.result, file?.buffer);
  }

  /** 巡查记录列表(按会话) */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PatrolListQueryDto) {
    if (!q.sessionId) return { list: [], total: 0 };
    return this.patrols.listBySession(user.id, q.sessionId);
  }

  /** 违纪快照图片流 */
  @Get(':id/snapshot')
  async snapshot(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const buf = await this.patrols.getSnapshot(user.id, id);
    return new StreamableFile(buf, {
      type: 'image/jpeg',
      disposition: 'inline',
    });
  }

  /** 删除违纪快照 */
  @Delete(':id/snapshot')
  deleteSnapshot(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.patrols.deleteSnapshot(user.id, id);
  }
}
